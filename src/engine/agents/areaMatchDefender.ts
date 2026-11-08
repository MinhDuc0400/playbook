/**
 * Area-match defender (D-40, "Bunch Killer"). Wraps the zone and man agents like ruleDefender: holds its
 * alignment spot and depth (never comes up to press) inside its base zone, ignoring receivers its teammates
 * claimed (as inferred by its own claim tracker), until the tracker gives it a man, then plays man (trail) on
 * him. Nobody comes → it stays (D-47). Emits `areaClaim` once per claim.
 */
import type { ID, Leverage, Point } from '@/domain/types';
import type { AnticipationModel } from '../anticipation';
import { createClaimTracker } from '../areaMatch';
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
  const corner = lanes.roles[index] === 'corner';
  const tracker = createClaimTracker({
    lanes,
    selfIndex: index,
    minX: info.minX,
    maxX: info.maxX,
  });
  let ignore: ReadonlySet<ID> = new Set();
  let manId: ID | null = null;

  const makeZone = (polygon: Point[], dropPoint: Point): DefenderAgent =>
    createZoneDefender({
      id,
      polygon,
      dropPoint,
      deep: base.deep,
      info,
      ...(anticipation ? { anticipation } : {}),
      ignore: () => ignore,
      holdDepth: binding.hold.y,
    });

  // Waits on its alignment spot (not the zone's drop point) and reacts from there: no press (D-40).
  let current: DefenderAgent = makeZone(base.polygon, binding.hold);

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
      // A corner without a man stays on its spot (D-47): its zone reacts to nobody until someone enters its
      // lane (then it plays man). Only a ball in the air moves it. Inside defenders play their zone.
      ignore = corner ? new Set(seen.map((o) => o.id)) : view.ignore;
      let events: NonNullable<AgentIntent['events']> | undefined;
      if (manId === null && view.manId !== null) {
        manId = view.manId;
        events = [
          { type: 'areaClaim', targetId: manId, data: { receiverId: manId, reason: view.reason ?? 'first' } },
        ];
        current = createManDefender({
          id,
          targetId: manId,
          technique: 'trail',
          cushion: 0,
          leverage,
          info,
          ...(anticipation ? { anticipation } : {}),
        });
      }
      const intent = current.step(self, p, dt, rng);
      return events ? { ...intent, events: [...(intent.events ?? []), ...events] } : intent;
    },
  };
}
