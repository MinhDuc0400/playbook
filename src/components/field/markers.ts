/** Timeline markers from engine events, with the player's label for the tooltip (D-34). */
import type { ID, PlayerSlot, SimEvent, SimEventType } from '@/domain/types';
import type { TimelineMarker } from './Timeline';

export function eventMarkers(
  events: readonly SimEvent[],
  types: ReadonlySet<SimEventType>,
  players: readonly PlayerSlot[],
): TimelineMarker[] {
  const labelOf = (id: ID | undefined): string | undefined =>
    id === undefined ? undefined : players.find((p) => p.id === id)?.label;
  return events
    .filter((e) => types.has(e.type))
    .map((e) => {
      if (e.type === 'areaClaim') {
        const by = labelOf(e.playerId);
        const to = labelOf(e.targetId);
        const label = by && to ? `${by} → ${to}` : (by ?? to);
        return label === undefined ? { t: e.t, type: e.type } : { t: e.t, type: e.type, label };
      }
      const label = labelOf(
        e.type === 'throw' || e.type === 'catch' ? (e.targetId ?? e.playerId) : e.playerId,
      );
      return label === undefined ? { t: e.t, type: e.type } : { t: e.t, type: e.type, label };
    });
}
