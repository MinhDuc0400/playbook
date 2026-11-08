import { describe, expect, it } from 'vitest';
import type { PlayerSlot, SimEvent, SimEventType } from '@/domain/types';
import { eventMarkers } from '../markers';

const players = [
  { id: 'a', label: 'X' },
  { id: 'q', label: 'QB' },
] as PlayerSlot[];
const types: ReadonlySet<SimEventType> = new Set(['snap', 'break', 'throw', 'catch']);

describe('eventMarkers (D-34)', () => {
  it('keeps listed types, adds the player label (the target for throw and catch)', () => {
    const events: SimEvent[] = [
      { t: -1, type: 'snap' },
      { t: 1, type: 'break', playerId: 'a' },
      { t: 2, type: 'throw', playerId: 'q', targetId: 'a' },
      { t: 3, type: 'read' },
    ];
    expect(eventMarkers(events, types, players)).toEqual([
      { t: -1, type: 'snap' },
      { t: 1, type: 'break', label: 'X' },
      { t: 2, type: 'throw', label: 'X' },
    ]);
  });

  it('omits the label for an unknown player id', () => {
    expect(eventMarkers([{ t: 1, type: 'break', playerId: 'zz' }], types, players)).toEqual([
      { t: 1, type: 'break' },
    ]);
  });
});
