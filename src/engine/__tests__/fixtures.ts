/** Shared engine test fixtures (no @/db imports: shapes copied from the seed plays). */
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { buildRoute, type RouteTemplateId } from '@/domain/routeTree';
import {
  SCHEMA_VERSION,
  type Action,
  type ID,
  type Leverage,
  type Play,
  type PlayerSlot,
  type Point,
  type Role,
  type SimInput,
  type Stats,
  type ZonePresetId,
} from '@/domain/types';

export function slot(
  id: ID,
  role: Role,
  label: string,
  start: Point,
  actions: Action[] = [],
  leverage?: Leverage,
): PlayerSlot {
  const s: PlayerSlot = { id, role, label, start, actions };
  if (leverage) s.leverage = leverage;
  return s;
}

export function makePlay(side: 'offense' | 'defense', players: PlayerSlot[], progression?: ID[]): Play {
  const play: Play = {
    id: `${side}-play`,
    schemaVersion: SCHEMA_VERSION,
    name: side,
    side,
    format: '5v5',
    formation: '',
    strength: 'right',
    players,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
  if (side === 'offense') play.progression = progression ?? [];
  else play.alignTo = 'ball';
  return play;
}

export const qbSlot = (): PlayerSlot =>
  slot('q', 'QB', 'Q', { x: 0, y: -5 }, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]);

export function wrSlot(
  id: ID,
  label: string,
  x: number,
  template: RouteTemplateId | null,
  depth?: number,
): PlayerSlot {
  const start = { x, y: -1 };
  return slot(id, 'WR', label, start, template ? [buildRoute(template, start, { depth })] : []);
}

export const rusherSlot = (): PlayerSlot =>
  slot('r1', 'R', 'R1', { x: 0, y: 7 }, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);

export function zoneSlot(
  id: ID,
  role: Role,
  label: string,
  start: Point,
  zone: ZonePresetId,
  dropPoint: Point,
  leverage: Leverage = 'outside',
): PlayerSlot {
  return slot(id, role, label, start, [{ type: 'zone', zone, dropPoint }], leverage);
}

/** Trips Flood (seed shape): Q, C drag, Z go, Y out, H flat. */
export function floodPlay(): Play {
  const wr = (label: string, x: number, t: RouteTemplateId, depth: number): PlayerSlot => {
    const start = { x, y: -1 };
    return slot(`f-${label.toLowerCase()}`, 'WR', label, start, [buildRoute(t, start, { depth })]);
  };
  const cStart = { x: 0, y: -0.5 };
  return makePlay(
    'offense',
    [
      slot('f-q', 'QB', 'Q', { x: 0, y: -5 }, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]),
      slot('f-c', 'C', 'C', cStart, [buildRoute('drag', cStart, { depth: 2, outward: 1 })]),
      wr('Z', 12, 'go', 15),
      wr('Y', 8, 'out', 10),
      wr('H', 4.5, 'flat', 1),
    ],
    ['f-y', 'f-h', 'f-z', 'f-c'],
  );
}

/** Cover 3 (seed shape): CB1, CB2 deep thirds, FS deep middle, LB hook, R1 rusher. */
export function cover3Play(): Play {
  return makePlay('defense', [
    zoneSlot('c-cb1', 'CB', 'CB1', { x: 12, y: 6 }, 'deep-third-R', { x: 10, y: 15 }),
    zoneSlot('c-cb2', 'CB', 'CB2', { x: -12, y: 6 }, 'deep-third-L', { x: -10, y: 15 }),
    zoneSlot('c-fs', 'S', 'FS', { x: 0, y: 11 }, 'deep-third-M', { x: 0, y: 16 }, 'head-up'),
    zoneSlot('c-lb', 'LB', 'LB', { x: -3, y: 5 }, 'hook-M', { x: 0, y: 6 }, 'head-up'),
    { ...rusherSlot(), id: 'c-r1' },
  ]);
}

export function statsFor(play: Play, stats: Stats = DEFAULT_PRESETS.avg): Record<ID, Stats> {
  const out: Record<ID, Stats> = {};
  for (const s of play.players) out[s.id] = { ...stats };
  return out;
}

export function makeInput(
  offense: Play,
  defense: Play,
  over: Partial<SimInput> & { offStats?: Stats; defStats?: Stats } = {},
): SimInput {
  const { offStats, defStats, ...rest } = over;
  return {
    offense,
    defense,
    offenseStats: statsFor(offense, offStats),
    defenseStats: statsFor(defense, defStats),
    field: createDefaultFields()['5v5'],
    ballSpot: DEFAULT_BALL_SPOT,
    anticipation: 0,
    seed: 1,
    noise: false,
    tuning: { ...DEFAULT_TUNING },
    routePriors: {},
    ...rest,
  };
}
