/**
 * Lane member defender (D-48): an area coordinator for its lane rules plus a rule defender in lane mode.
 * Bunch Killer (Bangkok) runs on this: corners stand on their spot, insides zone their base, and each goes
 * man on the receiver its area rule picks.
 */
import { laneSpan } from '@/domain/areaLanes';
import { LANE_ZONE_DEPTH } from '@/domain/areaRules';
import type { ID, Leverage, MatchRule, ReceiverRef } from '@/domain/types';
import type { AnticipationModel } from '../anticipation';
import { createAreaCoordinator } from '../areaCoordinator';
import type { FieldInfo, LaneBinding } from '../types';
import type { DefenderAgent } from './common';
import { createRuleDefender } from './ruleDefender';

export function createLaneDefender(opts: {
  id: ID;
  binding: LaneBinding;
  /** The slot's other (non-area) rules. */
  rules: readonly MatchRule[];
  leverage: Leverage | undefined;
  info: FieldInfo;
  anticipation?: AnticipationModel;
  resolveRef: (ref: ReceiverRef) => ID | null;
  strongSign: 1 | -1;
}): DefenderAgent {
  const { id, binding, info } = opts;
  const coordinator = createAreaCoordinator({
    lanes: binding.lanes,
    members: binding.members,
    selfId: id,
    minX: info.minX,
    maxX: info.maxX,
    resolveRef: opts.resolveRef,
    strongSign: opts.strongSign,
  });
  let base = binding.base;
  if (!base) {
    const [left, right] = laneSpan(binding.lanes, binding.lanes.order.indexOf(id), info.minX, info.maxX);
    base = {
      polygon: [
        { x: left, y: 0 },
        { x: right, y: 0 },
        { x: right, y: LANE_ZONE_DEPTH },
        { x: left, y: LANE_ZONE_DEPTH },
      ],
      dropPoint: binding.hold,
      deep: false,
    };
  }
  return createRuleDefender({
    id,
    initial: { kind: 'zone', ...base },
    rules: opts.rules,
    leverage: opts.leverage,
    info,
    ...(opts.anticipation ? { anticipation: opts.anticipation } : {}),
    resolveRef: opts.resolveRef,
    strongSign: opts.strongSign,
    lane: { coordinator, hold: binding.hold, stand: binding.base === null },
  });
}
