/**
 * Area coordinator (D-48; generalises the D-40 claim tracker). Pure.
 *
 * Every lane member runs one coordinator on its OWN delayed perception and evaluates the area rules
 * (`event: 'entersArea'`) of ALL lane members with the same rules, so it knows what its teammates took
 * without communication (NFR-ARC-06: the defense's own play, never the opponent's). Per update (perception
 * time t, offense non-QB players seen):
 * 1. Entry log: after the snap (t > 0), a receiver seen in a member's area where he has not been logged is
 *    appended to that area's entry list; same tick, nearer the sideline first (then id). D-51: a member's area is
 *    his zone outline when he has one (`area`; a receiver behind the LOS counts as level with a zone that starts
 *    at the LOS), else his lane between the midlines.
 * 2. Rules, in a fixed order: `nth` n = 1, then n = 2, then `any`; within a group by lane, left to right.
 *    A member with a man is skipped; each rule fires once. Area A = own lane or the teammate's lane (a
 *    teammate that is not a lane member makes the rule inert).
 *    - nth: A's entries minus receivers taken by members other than A's owner; the N-th of those, if not taken.
 *    - any: the first untaken receiver in A's entries.
 *    - minDepth / beforeTime apply to the trigger. No iq delay.
 *    - `manTrigger` takes the trigger for that member (sticky). Other reactions fire for self only.
 * 3. D-53 leftovers ("chưa ai nhận"): members still free with an `unclaimed` rule take receivers nobody took
 *    once they are at least `minDepth` deep: pairs by distance from the member's alignment spot (`at`), nearest
 *    first (then lane, then receiver id), one receiver per member. Runs after the area rules, so a second-out
 *    pick on the same tick wins.
 * The view lists receivers taken by other members in `ignore`.
 */
import { laneOf, laneSpan, type Lanes } from '@/domain/areaLanes';
import { pointInPolygon } from '@/domain/geometry';
import type { ID, MatchRule, Point } from '@/domain/types';
import type { PerceivedPlayer } from './types';

/** A lane member and its (valid) area rules. */
export interface LaneMember {
  id: ID;
  rules: readonly MatchRule[];
  /** D-51: his zone outline, which is his area; absent = his lane between the midlines. */
  area?: readonly Point[];
  /** D-53: alignment spot, for leftover distances; absent = his lane's middle on the LOS. */
  at?: Point;
}

/** In `area`; a point behind the LOS is taken level with a zone whose bottom is at or behind the LOS. */
export function inZoneArea(p: Point, area: readonly Point[]): boolean {
  const minY = Math.min(...area.map((q) => q.y));
  return pointInPolygon(minY <= 0 && p.y < minY ? { x: p.x, y: minY } : p, area);
}

export interface AreaView {
  /** Self's area rule that fires on THIS tick (each rule fires once). */
  fired: { rule: MatchRule; receiverId: ID } | null;
  /** Self's man from an area `manTrigger` rule (sticky), or null. */
  manId: ID | null;
  /** Receivers taken by other members. */
  ignore: ReadonlySet<ID>;
}

export interface AreaCoordinator {
  update(t: number, seen: readonly PerceivedPlayer[]): AreaView;
}

const groupOf = (r: MatchRule): number =>
  r.when.receiver.kind === 'nth' ? r.when.receiver.n - 1 : r.when.receiver.kind === 'any' ? 2 : 3;

export function createAreaCoordinator(opts: {
  lanes: Lanes;
  members: readonly LaneMember[];
  selfId: ID;
  minX: number;
  maxX: number;
}): AreaCoordinator {
  const { lanes, members, selfId, minX, maxX } = opts;
  const laneIndex = new Map(lanes.order.map((id, i) => [id, i]));
  /** Owner member id → receivers who entered his area, in order. */
  const entries = new Map<ID, ID[]>(members.map((m) => [m.id, []]));
  const inside = (m: LaneMember, p: Point): boolean =>
    m.area ? inZoneArea(p, m.area) : laneOf(lanes, p.x) === laneIndex.get(m.id);
  /** member id → receiver it took. */
  const taken = new Map<ID, ID>();
  /** `${member}\u0000${rule.id}`: rule ids are only unique per slot (a Ctrl+D copy keeps them). */
  const fired = new Set<string>();
  const key = (member: ID, rule: MatchRule): string => `${member}\u0000${rule.id}`;

  // Rules in evaluation order: group, then lane (left → right), then priority / array order.
  const ordered = members
    .flatMap((m) =>
      [...m.rules]
        .map((rule, k) => ({ member: m.id, rule, k }))
        .filter(({ rule }) => groupOf(rule) < 3 && rule.when.event === 'entersArea' && laneIndex.has(m.id)),
    )
    .sort(
      (a, b) =>
        groupOf(a.rule) - groupOf(b.rule) ||
        laneIndex.get(a.member)! - laneIndex.get(b.member)! ||
        a.rule.priority - b.rule.priority ||
        a.k - b.k,
    );

  /** D-53: members' leftover rules (priority order) and alignment spots. */
  const leftover = members
    .filter((m) => laneIndex.has(m.id))
    .map((m) => {
      const lane = laneIndex.get(m.id)!;
      const [left, right] = laneSpan(lanes, lane, minX, maxX);
      return {
        id: m.id,
        lane,
        at: m.at ?? { x: (left + right) / 2, y: 0 },
        rules: m.rules.filter((r) => r.when.event === 'unclaimed').sort((a, b) => a.priority - b.priority),
      };
    })
    .filter((m) => m.rules.length > 0);

  const sidelineDist = (x: number): number => Math.min(x - minX, maxX - x);
  const takenBy = (rid: ID): ID | undefined => {
    for (const [m, r] of taken) if (r === rid) return m;
    return undefined;
  };

  return {
    update(t, seen) {
      if (t > 0) {
        const fresh = [...seen].sort(
          (a, b) => sidelineDist(a.pos.x) - sidelineDist(b.pos.x) || (a.id < b.id ? -1 : 1),
        );
        for (const m of members) {
          if (!laneIndex.has(m.id)) continue;
          const log = entries.get(m.id)!;
          for (const p of fresh) if (!log.includes(p.id) && inside(m, p.pos)) log.push(p.id);
        }
      }

      let mine: AreaView['fired'] = null;
      for (const { member, rule } of ordered) {
        if (fired.has(key(member, rule)) || taken.has(member)) continue;
        const { when } = rule;
        if (when.beforeTime !== undefined && t >= when.beforeTime) continue;
        const owner = when.area?.kind === 'teammate' ? when.area.slotId : member;
        const log = laneIndex.has(owner) ? entries.get(owner) : undefined;
        if (log === undefined || (when.area?.kind === 'teammate' && owner === member)) continue;
        const candidates = log.filter((id) => {
          const by = takenBy(id);
          return by === undefined || by === owner;
        });
        const pick =
          when.receiver.kind === 'nth'
            ? candidates[when.receiver.n - 1]
            : candidates.find((id) => takenBy(id) === undefined);
        if (pick === undefined || takenBy(pick) !== undefined) continue;
        if (when.minDepth !== undefined) {
          const p = seen.find((x) => x.id === pick);
          if (!p || p.pos.y < when.minDepth) continue;
        }
        if (rule.then.type === 'manTrigger') {
          fired.add(key(member, rule));
          taken.set(member, pick);
          if (member === selfId && !mine) mine = { rule, receiverId: pick };
        } else if (member === selfId && !mine) {
          fired.add(key(member, rule));
          mine = { rule, receiverId: pick };
        }
      }

      if (t > 0 && leftover.length > 0) {
        const takenIds = new Set(taken.values());
        const pairs: { member: (typeof leftover)[number]; rule: MatchRule; id: ID; d: number }[] = [];
        for (const m of leftover) {
          if (taken.has(m.id)) continue;
          const rule = m.rules.find(
            (r) => !fired.has(key(m.id, r)) && (r.when.beforeTime === undefined || t < r.when.beforeTime),
          );
          if (!rule) continue;
          for (const p of seen) {
            if (takenIds.has(p.id) || p.pos.y < (rule.when.minDepth ?? 0)) continue;
            pairs.push({ member: m, rule, id: p.id, d: Math.hypot(p.pos.x - m.at.x, p.pos.y - m.at.y) });
          }
        }
        pairs.sort((a, b) => a.d - b.d || a.member.lane - b.member.lane || (a.id < b.id ? -1 : 1));
        const usedM = new Set<ID>();
        const usedR = new Set<ID>();
        for (const { member, rule, id } of pairs) {
          if (usedM.has(member.id) || usedR.has(id)) continue;
          usedM.add(member.id);
          usedR.add(id);
          if (rule.then.type === 'manTrigger') {
            fired.add(key(member.id, rule));
            taken.set(member.id, id);
            if (member.id === selfId && !mine) mine = { rule, receiverId: id };
          } else if (member.id === selfId && !mine) {
            fired.add(key(member.id, rule));
            mine = { rule, receiverId: id };
          }
        }
      }

      const ignore = new Set<ID>();
      for (const [m, r] of taken) if (m !== selfId) ignore.add(r);
      return { fired: mine, manId: taken.get(selfId) ?? null, ignore };
    },
  };
}
