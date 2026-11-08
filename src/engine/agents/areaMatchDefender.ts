/**
 * Area-match defender (D-40, "Bunch Killer"). Wraps the zone and man agents like ruleDefender: plays its
 * base zone (ignoring receivers its teammates claimed, as inferred by its own claim tracker) until the
 * tracker gives it a man, then plays man (trail) on him. A corner that squeezes without a man moves its
 * zone onto the inner lane boundary. Emits `areaClaim` once per claim.
 */
import type { ID, Leverage, Point } from '@/domain/types';
import type { AnticipationModel } from '../anticipation';
import { createClaimTracker } from '../areaMatch';
import { centroid } from '../matchRules';
import type { AgentIntent, AreaMatchBinding, FieldInfo } from '../types';
import type { DefenderAgent } from './common';
import { createManDefender } from './manDefender';
import { createZoneDefender } from './zoneDefender';

export function createAreaMatchDefender(opts: {
  id: ID;
  binding: AreaMatchBinding;
  leverage: Leverage | undefined;
  info: FieldInfo;
  anticipation?: AnticipationModel;
}): DefenderAgent {
  const { id, binding, leverage, info, anticipation } = opts;
  const { lanes, index, base } = binding;
  const tracker = createClaimTracker({
    lanes,
    selfIndex: index,
    squeezeAfter: binding.squeezeAfter,
    minX: info.minX,
    maxX: info.maxX,
  });
  let ignore: ReadonlySet<ID> = new Set();
  let manId: ID | null = null;
  let squeezed = false;

  const makeZone = (polygon: Point[], dropPoint: Point): DefenderAgent =>
    createZoneDefender({
      id,
      polygon,
      dropPoint,
      deep: base.deep,
      info,
      ...(anticipation ? { anticipation } : {}),
      ignore: () => ignore,
    });

  /** Base zone shifted so its centre sits on the boundary with the inner lane. */
  const squeezedZone = (): DefenderAgent => {
    const boundary = index === 0 ? lanes.boundaries[0] : lanes.boundaries[index - 1];
    if (boundary === undefined) return current;
    const dx = boundary - centroid(base.polygon).x;
    return makeZone(
      base.polygon.map((p) => ({ x: p.x + dx, y: p.y })),
      { x: base.dropPoint.x + dx, y: base.dropPoint.y },
    );
  };

  let current: DefenderAgent = makeZone(base.polygon, base.dropPoint);

  return {
    id,
    get lastAim() {
      return current.lastAim;
    },
    get targetId() {
      return current.targetId;
    },
    step(self, p, dt, rng): AgentIntent {
      const seen = p.others.filter((o) => o.side === 'offense' && o.role !== 'QB');
      const view = tracker.update(p.t, seen);
      ignore = view.ignore;
      let events: NonNullable<AgentIntent['events']> | undefined;
      if (manId === null && view.manId !== null) {
        manId = view.manId;
        events = [{ type: 'areaClaim', targetId: manId, data: { receiverId: manId, reason: view.reason ?? 'first' } }];
        current = createManDefender({
          id,
          targetId: manId,
          technique: 'trail',
          cushion: 0,
          leverage,
          info,
          ...(anticipation ? { anticipation } : {}),
        });
      } else if (manId === null && view.squeezed && !squeezed) {
        squeezed = true;
        current = squeezedZone();
      }
      const intent = current.step(self, p, dt, rng);
      return events ? { ...intent, events: [...(intent.events ?? []), ...events] } : intent;
    },
  };
}
