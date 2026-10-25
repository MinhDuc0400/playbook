/** Record factories for db tests. */
import { createDefaultSettings } from '@/domain/defaults';
import {
  SCHEMA_VERSION,
  type Athlete,
  type ID,
  type Install,
  type Lineup,
  type Matchup,
  type Play,
  type Settings,
} from '@/domain/types';

const T0 = 1_700_000_000_000;

export function makePlay(id: ID, over: Partial<Play> = {}): Play {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: `Play ${id}`,
    side: 'offense',
    format: '5v5',
    formation: 'Trips',
    strength: 'right',
    players: [
      { id: `${id}-s1`, role: 'QB', label: 'Q', start: { x: 0, y: -5 }, actions: [] },
      { id: `${id}-s2`, role: 'WR', label: 'X', start: { x: -8, y: 0 }, actions: [] },
    ],
    tags: [],
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

export function makeAthlete(id: ID, over: Partial<Athlete> = {}): Athlete {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: `Athlete ${id}`,
    preset: 'avg',
    stats: createDefaultSettings().presets.avg,
    positions: ['WR'],
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

export function makeLineup(id: ID, over: Partial<Lineup> = {}): Lineup {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: `Lineup ${id}`,
    side: 'offense',
    format: '5v5',
    slots: [{ label: 'X', preset: 'avg' }],
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

export function makeMatchup(
  id: ID,
  offensePlayId: ID,
  defensePlayId: ID,
  over: Partial<Matchup> = {},
): Matchup {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    offensePlayId,
    offenseFlipped: false,
    defensePlayId,
    defenseFlip: 'auto',
    overrides: [],
    anticipation: 0.5,
    ballSpot: { x: 0, yardLine: 25 },
    seed: 1,
    noise: false,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

/** Install with one item per matchup id, order 0..n-1 (item ids `${id}-i${n}`). */
export function makeInstall(id: ID, matchupIds: ID[], over: Partial<Install> = {}): Install {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: `Install ${id}`,
    items: matchupIds.map((matchupId, order) => ({ id: `${id}-i${order}`, matchupId, order })),
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

export function makeSettings(over: Partial<Settings> = {}): Settings {
  return { ...createDefaultSettings(), ...over };
}
