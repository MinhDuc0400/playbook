/**
 * Defender with pattern-match rules (SRS §5.4, §8.6 "Luật match", FR-ENG-09). Wraps the man / zone agents:
 * each tick it evaluates the slot's rules on the delayed Perception, emits `ruleFired` and switches mode.
 */
import type { ID, Leverage, MatchRule, Point, ReceiverRef, ZonePresetId } from '@/domain/types';
import { hookZoneForX, isDeepZone, zonePreset } from '@/domain/zones';
import type { AnticipationModel } from '../anticipation';
import { evaluateRules } from '../matchRules';
import type { AgentIntent, FieldInfo } from '../types';
import type { DefenderAgent } from './common';
import { createManDefender } from './manDefender';
import { createZoneDefender } from './zoneDefender';

export type InitialCoverage =
  | { kind: 'man'; targetId: ID; technique: 'trail' | 'cushion'; cushion: number }
  | { kind: 'zone'; polygon: Point[]; dropPoint: Point; deep: boolean };

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
}): DefenderAgent {
  const { id, rules, leverage, info, anticipation, resolveRef, strongSign } = opts;
  let carryId: ID | null = null;
  let released = new Set<ID>();
  const fired = new Set<ID>();
  let heldSince: Record<ID, number> = {};
  const technique: 'trail' | 'cushion' = opts.initial.kind === 'man' ? opts.initial.technique : 'trail';
  const cushion = opts.initial.kind === 'man' ? opts.initial.cushion : 0;

  const makeMan = (targetId: ID): DefenderAgent =>
    createManDefender({
      id,
      targetId,
      technique,
      cushion,
      leverage,
      info,
      ...(anticipation ? { anticipation } : {}),
    });
  const makeZone = (polygon: Point[], dropPoint: Point, deep: boolean): DefenderAgent =>
    createZoneDefender({
      id,
      polygon,
      dropPoint,
      deep,
      info,
      ...(anticipation ? { anticipation } : {}),
      carry: () => carryId,
      ignore: () => released,
    });
  const makePreset = (zone: ZonePresetId): DefenderAgent => {
    const shape = zonePreset(zone, info.field);
    return makeZone(shape.polygon, shape.dropPoint, isDeepZone(zone));
  };

  let current: DefenderAgent =
    opts.initial.kind === 'man'
      ? makeMan(opts.initial.targetId)
      : makeZone(opts.initial.polygon, opts.initial.dropPoint, opts.initial.deep);

  return {
    id,
    get lastAim() {
      return current.lastAim;
    },
    get targetId() {
      return current.targetId;
    },
    step(self, p, dt, rng): AgentIntent {
      let events: NonNullable<AgentIntent['events']> | undefined;
      if (rules.length > 0) {
        const res = evaluateRules({
          rules,
          perceived: p.others.filter((o) => o.side === 'offense' && o.role !== 'QB'),
          resolveRef,
          resolveThenRef: resolveRef,
          t: self.t,
          iq: self.stats.iq,
          fired,
          heldSince,
          strongSign,
        });
        heldSince = res.heldSince;
        const hit = res.fired;
        if (hit) {
          fired.add(hit.rule.id);
          const o = hit.outcome;
          events = [{ type: 'ruleFired', data: { ruleId: hit.rule.id, outcome: o.type } }];
          if (o.type === 'man') {
            carryId = null;
            released = new Set();
            current = makeMan(o.targetId);
          } else if (o.type === 'zone') {
            carryId = null;
            released = new Set();
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
            current = makePreset(hookZoneForX(self.pos.x));
          }
        }
      }
      const intent = current.step(self, p, dt, rng);
      return events ? { ...intent, events: [...(intent.events ?? []), ...events] } : intent;
    },
  };
}
