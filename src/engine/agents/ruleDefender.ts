/**
 * Defender with pattern-match rules (SRS §5.4, §8.6 "Luật match", FR-ENG-09). Wraps the man / zone agents:
 * each tick it evaluates the slot's rules on the delayed Perception, emits `ruleFired` and switches mode.
 * D-48: a lane member also gets `lane`: its area rules come from the area coordinator (no iq delay); until a
 * rule changes its coverage it holds its alignment depth (no press) in its base zone, ignoring receivers
 * teammates took, or stands on its spot (`stand`) reacting only to the ball.
 */
import type { ID, Leverage, MatchRule, Point, ReceiverRef, ZonePresetId } from '@/domain/types';
import { hookZoneForX, isDeepZone, zonePreset } from '@/domain/zones';
import type { AnticipationModel } from '../anticipation';
import type { AreaCoordinator } from '../areaCoordinator';
import { evaluateRules, type RuleOutcome } from '../matchRules';
import type { AgentIntent, FieldInfo } from '../types';
import type { DefenderAgent } from './common';
import { createManDefender } from './manDefender';
import { createZoneDefender } from './zoneDefender';

export type InitialCoverage =
  | { kind: 'man'; targetId: ID; technique: 'trail' | 'cushion'; cushion: number }
  | { kind: 'zone'; polygon: Point[]; dropPoint: Point; deep: boolean };

export interface LaneOptions {
  coordinator: AreaCoordinator;
  /** Alignment spot: base zone starts here and never aims shallower than hold.y. */
  hold: Point;
  /** No base zone: stand on `hold`, react to nobody until a rule fires. */
  stand: boolean;
}

export function createRuleDefender(opts: {
  id: ID;
  initial: InitialCoverage;
  rules: readonly MatchRule[];
  leverage: Leverage | undefined;
  info: FieldInfo;
  anticipation?: AnticipationModel;
  /** Receiver ref → slot id from the snap numbering (also used for `then.target`). */
  resolveRef: (ref: ReceiverRef) => ID | null;
  strongSign: 1 | -1;
  lane?: LaneOptions;
}): DefenderAgent {
  const { id, rules, leverage, info, anticipation, resolveRef, strongSign, lane } = opts;
  let carryId: ID | null = null;
  let released = new Set<ID>();
  let areaIgnore: ReadonlySet<ID> = new Set();
  let seenIds: ReadonlySet<ID> = new Set();
  let onBase = true;
  const fired = new Set<ID>();
  let heldSince: Record<ID, number> = {};
  const technique: 'trail' | 'cushion' = opts.initial.kind === 'man' ? opts.initial.technique : 'trail';
  const cushion = opts.initial.kind === 'man' ? opts.initial.cushion : 0;

  const makeMan = (targetId: ID, how = { technique, cushion }): DefenderAgent =>
    createManDefender({
      id,
      targetId,
      technique: how.technique,
      cushion: how.cushion,
      leverage,
      info,
      ...(anticipation ? { anticipation } : {}),
    });
  const ignored = (): ReadonlySet<ID> => {
    if (!lane || !onBase) return released;
    if (lane.stand) return seenIds;
    if (areaIgnore.size === 0) return released;
    if (released.size === 0) return areaIgnore;
    return new Set([...released, ...areaIgnore]);
  };
  const makeZone = (polygon: Point[], dropPoint: Point, deep: boolean, base = false): DefenderAgent =>
    createZoneDefender({
      id,
      polygon,
      dropPoint,
      deep,
      info,
      ...(anticipation ? { anticipation } : {}),
      carry: () => carryId,
      ignore: ignored,
      ...(base && lane ? { holdDepth: lane.hold.y } : {}),
    });
  const makePreset = (zone: ZonePresetId): DefenderAgent => {
    const shape = zonePreset(zone, info.field);
    return makeZone(shape.polygon, shape.dropPoint, isDeepZone(zone));
  };

  let current: DefenderAgent =
    opts.initial.kind === 'man'
      ? makeMan(opts.initial.targetId)
      : makeZone(opts.initial.polygon, lane ? lane.hold : opts.initial.dropPoint, opts.initial.deep, true);
  if (opts.initial.kind === 'man') onBase = false;

  /** Apply a fired rule's outcome; returns the ruleFired event. */
  const apply = (
    rule: MatchRule,
    o: RuleOutcome,
    self: { pos: Point },
  ): NonNullable<AgentIntent['events']>[number] => {
    if (o.type === 'man' || o.type === 'manTrigger') {
      carryId = null;
      released = new Set();
      onBase = false;
      // "Man người đó" plays trail with no cushion, like the D-40 area claim.
      current =
        o.type === 'manTrigger'
          ? makeMan(o.targetId, { technique: 'trail', cushion: 0 })
          : makeMan(o.targetId);
    } else if (o.type === 'zone') {
      carryId = null;
      released = new Set();
      onBase = false;
      current = makePreset(o.zone);
    } else if (o.type === 'carry') {
      if (current.targetId === null) {
        carryId = o.receiverId;
        released.delete(o.receiverId);
      }
    } else if (current.targetId === null) {
      released = new Set(released).add(o.receiverId);
      if (carryId === o.receiverId) carryId = null;
    } else if (current.targetId === o.receiverId) {
      carryId = null;
      released = new Set([o.receiverId]);
      onBase = false;
      current = makePreset(hookZoneForX(self.pos.x));
    }
    if (o.type === 'manTrigger') {
      const n = rule.when.receiver.kind === 'nth' ? rule.when.receiver.n : undefined;
      return {
        type: 'ruleFired',
        targetId: o.targetId,
        data: { ruleId: rule.id, outcome: o.type, receiverId: o.targetId, ...(n ? { n } : {}) },
      };
    }
    return { type: 'ruleFired', data: { ruleId: rule.id, outcome: o.type } };
  };

  return {
    id,
    get lastAim() {
      return current.lastAim;
    },
    get targetId() {
      return current.targetId;
    },
    step(self, p, dt, rng): AgentIntent {
      const events: NonNullable<AgentIntent['events']> = [];
      const offense = p.others.filter((o) => o.side === 'offense' && o.role !== 'QB');
      if (lane) {
        seenIds = new Set(offense.map((o) => o.id));
        const view = lane.coordinator.update(p.t, offense);
        areaIgnore = view.ignore;
        if (view.fired) {
          const { rule, receiverId } = view.fired;
          fired.add(rule.id);
          const o: RuleOutcome =
            rule.then.type === 'manTrigger'
              ? { type: 'manTrigger', targetId: receiverId }
              : rule.then.type === 'man'
                ? { type: 'man', targetId: resolveRef(rule.then.target) ?? receiverId }
                : rule.then.type === 'zone'
                  ? { type: 'zone', zone: rule.then.zone }
                  : { type: rule.then.type, receiverId };
          events.push(apply(rule, o, self));
        }
      }
      if (rules.length > 0) {
        const res = evaluateRules({
          rules,
          perceived: offense,
          resolveRef,
          resolveThenRef: resolveRef,
          t: self.t,
          iq: self.stats.iq,
          fired,
          heldSince,
          strongSign,
          bounds: { minX: info.minX, maxX: info.maxX },
        });
        heldSince = res.heldSince;
        if (res.fired) {
          fired.add(res.fired.rule.id);
          events.push(apply(res.fired.rule, res.fired.outcome, self));
        }
      }
      const intent = current.step(self, p, dt, rng);
      return events.length > 0 ? { ...intent, events: [...(intent.events ?? []), ...events] } : intent;
    },
  };
}
