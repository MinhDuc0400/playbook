/** Shared fixtures for the editor tests. */
import { SCHEMA_VERSION, type Play, type PlayerSlot, type Point } from '@/domain/types';

export function slot(
  id: string,
  role: PlayerSlot['role'],
  start: Point,
  actions: PlayerSlot['actions'] = [],
  label = id,
): PlayerSlot {
  return { id, role, label, start, actions };
}

export function mkPlay(players: PlayerSlot[], rest: Partial<Play> = {}): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    ...rest,
    players,
  };
}

/** QB, C, X with a 2-point route, Z without a route. */
export function offenseFixture(): Play {
  return mkPlay([
    slot('q', 'QB', { x: 0, y: -5 }, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }], 'Q'),
    slot('c', 'C', { x: 0, y: 0 }, [], 'C'),
    slot(
      'x',
      'WR',
      { x: -8, y: 0 },
      [
        {
          type: 'route',
          path: [
            { x: -8, y: 10 },
            { x: -4, y: 14 },
          ],
          endBehavior: 'continue',
        },
      ],
      'X',
    ),
    slot('z', 'WR', { x: 8, y: 0 }, [], 'Z'),
  ]);
}
