/**
 * Area coordinator (D-48; generalises the D-40 claim tracker). Pure.
 *
 * Every lane member runs one coordinator on its OWN delayed perception and evaluates the area rules
 * (`event: 'entersArea'`) of ALL lane members with the same rules, so it knows what its teammates took
 * without communication (NFR-ARC-06: the defense's own play, never the opponent's). Per update (perception
 * time t, offense non-QB players seen):
 * 1. Entry log: after the snap (t > 0), a receiver seen in a lane where he has not been logged is appended to
 *    that lane's entry list; same tick, nearer the sideline first (then id).
 * 2. Rules, in a fixed order: `nth` n = 1, then n = 2, then `any`; within a group by lane, left to right.
 *    A member with a man is skipped; each rule fires once. Area A = own lane or the teammate's lane (a
 *    teammate that is not a lane member makes the rule inert).
 *    - nth: A's entries minus receivers taken by members other than A's owner; the N-th of those, if not taken.
 *    - any: the first untaken receiver in A's entries.
 *    - minDepth / beforeTime apply to the trigger. No iq delay.
 *    - `manTrigger` takes the trigger for that member (sticky). Other reactions fire for self only.
 * The view lists receivers taken by other members in `ignore`.
 */
import { laneOf, type Lanes } from '@/domain/areaLanes';
import type { ID, MatchRule } from '@/domain/types';
import type { PerceivedPlayer } from './types';

/** A lane member and its (valid) area rules. */
export interface LaneMember {
  id: ID;
  rules: readonly MatchRule[];
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
  const n = lanes.order.length;
  const laneIndex = new Map(lanes.order.map((id, i) => [id, i]));
  const entries: ID[][] = Array.from({ length: n }, () => []);
  /** member id → receiver it took. */
  const taken = new Map<ID, ID>();
  const fired = new Set<ID>();

  // Rules in evaluation order: group, then lane (left → right), then priority / array order.
  const ordered = members
    .flatMap((m) =>
      [...m.rules]
        .map((rule, k) => ({ member: m.id, rule, k }))
        .filter(({ rule }) => groupOf(rule) < 3 && laneIndex.has(m.id)),
    )
    .sort(
      (a, b) =>
        groupOf(a.rule) - groupOf(b.rule) ||
        laneIndex.get(a.member)! - laneIndex.get(b.member)! ||
        a.rule.priority - b.rule.priority ||
        a.k - b.k,
    );

  const sidelineDist = (x: number): number => Math.min(x - minX, maxX - x);
  const takenBy = (rid: ID): ID | undefined => {
    for (const [m, r] of taken) if (r === rid) return m;
    return undefined;
  };

  return {
    update(t, seen) {
      if (t > 0) {
        const fresh = seen
          .map((p) => ({ p, lane: laneOf(lanes, p.pos.x) }))
          .filter(({ p, lane }) => !entries[lane]!.includes(p.id))
          .sort((a, b) => sidelineDist(a.p.pos.x) - sidelineDist(b.p.pos.x) || (a.p.id < b.p.id ? -1 : 1));
        for (const { p, lane } of fresh) entries[lane]!.push(p.id);
      }

      let mine: AreaView['fired'] = null;
      for (const { member, rule } of ordered) {
        if (fired.has(rule.id) || taken.has(member)) continue;
        const { when } = rule;
        if (when.beforeTime !== undefined && t >= when.beforeTime) continue;
        const owner = when.area?.kind === 'teammate' ? when.area.slotId : member;
        const a = laneIndex.get(owner);
        if (a === undefined || (when.area?.kind === 'teammate' && owner === member)) continue;
        const candidates = entries[a]!.filter((id) => {
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
          fired.add(rule.id);
          taken.set(member, pick);
          if (member === selfId && !mine) mine = { rule, receiverId: pick };
        } else if (member === selfId && !mine) {
          fired.add(rule.id);
          mine = { rule, receiverId: pick };
        }
      }

      const ignore = new Set<ID>();
      for (const [m, r] of taken) if (m !== selfId) ignore.add(r);
      return { fired: mine, manId: taken.get(selfId) ?? null, ignore };
    },
  };
}
