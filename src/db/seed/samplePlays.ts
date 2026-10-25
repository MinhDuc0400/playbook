/**
 * Sample 5v5 plays seeded on first open (FR-DAT-05, D-01, D-16).
 * Fixed ids so tests, E2E and the tuning benchmark can reference them.
 * Route paths come from the route tree (D-08); never hand-written.
 */
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
  type Strength,
  type ZonePresetId,
} from '@/domain/types';

export const SEED_IDS = {
  flood: 'seed-off-trips-flood',
  mesh: 'seed-off-mesh',
  smash: 'seed-off-smash',
  cover1: 'seed-def-cover-1',
  cover2: 'seed-def-cover-2',
  cover3: 'seed-def-cover-3',
} as const;

function slot(
  playId: ID,
  role: Role,
  label: string,
  start: Point,
  actions: Action[],
  leverage?: Leverage,
): PlayerSlot {
  const s: PlayerSlot = { id: `${playId}-${label.toLowerCase()}`, role, label, start, actions };
  if (leverage) s.leverage = leverage;
  return s;
}

function offenseBase(playId: ID): PlayerSlot[] {
  return [slot(playId, 'QB', 'Q', { x: 0, y: -5 }, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }])];
}

function wr(playId: ID, label: string, x: number, template: RouteTemplateId, depth: number): PlayerSlot {
  const start = { x, y: -1 };
  return slot(playId, 'WR', label, start, [buildRoute(template, start, { depth })]);
}

function center(playId: ID, template: RouteTemplateId, depth: number, outward: 1 | -1): PlayerSlot {
  const start = { x: 0, y: -0.5 };
  return slot(playId, 'C', 'C', start, [buildRoute(template, start, { depth, outward })]);
}

interface OffenseSpec {
  id: ID;
  name: string;
  formation: string;
  strength: Strength;
  tags: string[];
  receivers: PlayerSlot[];
  c: PlayerSlot;
  progression: string[]; // labels
}

function offensePlay(spec: OffenseSpec, now: number): Play {
  return {
    id: spec.id,
    schemaVersion: SCHEMA_VERSION,
    name: spec.name,
    side: 'offense',
    format: '5v5',
    formation: spec.formation,
    strength: spec.strength,
    players: [...offenseBase(spec.id), spec.c, ...spec.receivers],
    progression: spec.progression.map((l) => `${spec.id}-${l.toLowerCase()}`),
    tags: spec.tags,
    createdAt: now,
    updatedAt: now,
  };
}

function rusher(playId: ID): PlayerSlot {
  return slot(playId, 'R', 'R1', { x: 0, y: 7 }, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);
}

function zoneSlot(
  playId: ID,
  role: Role,
  label: string,
  start: Point,
  leverage: Leverage,
  zone: ZonePresetId,
  dropPoint: Point,
): PlayerSlot {
  return slot(playId, role, label, start, [{ type: 'zone', zone, dropPoint }], leverage);
}

interface DefenseSpec {
  id: ID;
  name: string;
  formation: string;
  alignTo: 'ball' | 'strength';
  tags: string[];
  players: PlayerSlot[];
}

function defensePlay(spec: DefenseSpec, now: number): Play {
  return {
    id: spec.id,
    schemaVersion: SCHEMA_VERSION,
    name: spec.name,
    side: 'defense',
    format: '5v5',
    formation: spec.formation,
    strength: 'right',
    alignTo: spec.alignTo,
    players: [...spec.players, rusher(spec.id)],
    tags: spec.tags,
    createdAt: now,
    updatedAt: now,
  };
}

/** 3 offense + 3 defense 5v5 plays, timestamps = now. */
export function createSamplePlays(now: number): Play[] {
  const f = SEED_IDS.flood;
  const m = SEED_IDS.mesh;
  const s = SEED_IDS.smash;
  const c1 = SEED_IDS.cover1;
  const c2 = SEED_IDS.cover2;
  const c3 = SEED_IDS.cover3;

  const flood = offensePlay(
    {
      id: f,
      name: 'Trips Flood',
      formation: 'Trips',
      strength: 'right',
      tags: ['beats:cover-3', 'concept:flood'],
      c: center(f, 'drag', 2, 1),
      receivers: [wr(f, 'Z', 12, 'go', 15), wr(f, 'Y', 8, 'out', 10), wr(f, 'H', 4.5, 'flat', 1)],
      progression: ['Y', 'H', 'Z', 'C'],
    },
    now,
  );

  const mesh = offensePlay(
    {
      id: m,
      name: 'Mesh',
      formation: '2x1',
      strength: 'left',
      tags: ['beats:cover-1', 'beats:man', 'concept:mesh', 'quick'],
      c: center(m, 'hitch', 5, -1),
      receivers: [wr(m, 'X', -12, 'go', 15), wr(m, 'Y', -6, 'drag', 2), wr(m, 'Z', 12, 'drag', 4)],
      progression: ['Y', 'Z', 'C', 'X'],
    },
    now,
  );

  const smash = offensePlay(
    {
      id: s,
      name: 'Smash',
      formation: '2x1',
      strength: 'right',
      tags: ['beats:cover-2', 'concept:smash'],
      c: center(s, 'flat', 1, -1),
      receivers: [wr(s, 'Z', 12, 'hitch', 5), wr(s, 'Y', 7, 'corner', 10), wr(s, 'X', -12, 'slant', 3)],
      progression: ['Y', 'Z', 'X', 'C'],
    },
    now,
  );

  const cover1 = defensePlay(
    {
      id: c1,
      name: 'Cover 1',
      formation: 'Cover 1',
      alignTo: 'strength',
      tags: ['cov:cover-1', 'cov:man'],
      players: [
        slot(
          c1,
          'CB',
          'CB1',
          { x: 11, y: 5 },
          [
            {
              type: 'man',
              target: { kind: 'number', side: 'strong', number: 1 },
              technique: 'cushion',
              cushion: 4,
            },
          ],
          'inside',
        ),
        slot(
          c1,
          'CB',
          'CB2',
          { x: -11, y: 5 },
          [
            {
              type: 'man',
              target: { kind: 'number', side: 'weak', number: 1 },
              technique: 'cushion',
              cushion: 4,
            },
          ],
          'inside',
        ),
        slot(
          c1,
          'LB',
          'LB',
          { x: 5, y: 4 },
          [
            {
              type: 'man',
              target: { kind: 'number', side: 'strong', number: 2 },
              technique: 'trail',
            },
          ],
          'inside',
        ),
        slot(c1, 'S', 'FS', { x: 0, y: 12 }, [
          { type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 14 } },
        ]),
      ],
    },
    now,
  );

  const cover2 = defensePlay(
    {
      id: c2,
      name: 'Cover 2',
      formation: 'Cover 2',
      alignTo: 'ball',
      tags: ['cov:cover-2', 'cov:zone'],
      players: [
        zoneSlot(c2, 'CB', 'CB1', { x: 12, y: 4 }, 'outside', 'flat-R', { x: 10, y: 5 }),
        zoneSlot(c2, 'CB', 'CB2', { x: -12, y: 4 }, 'outside', 'flat-L', { x: -10, y: 5 }),
        slot(c2, 'S', 'S1', { x: 7, y: 12 }, [
          { type: 'zone', zone: 'deep-half-R', dropPoint: { x: 7, y: 16 } },
        ]),
        slot(c2, 'S', 'S2', { x: -7, y: 12 }, [
          { type: 'zone', zone: 'deep-half-L', dropPoint: { x: -7, y: 16 } },
        ]),
      ],
    },
    now,
  );

  const cover3 = defensePlay(
    {
      id: c3,
      name: 'Cover 3',
      formation: 'Cover 3',
      alignTo: 'ball',
      tags: ['cov:cover-3', 'cov:zone'],
      players: [
        zoneSlot(c3, 'CB', 'CB1', { x: 12, y: 6 }, 'outside', 'deep-third-R', { x: 10, y: 15 }),
        zoneSlot(c3, 'CB', 'CB2', { x: -12, y: 6 }, 'outside', 'deep-third-L', { x: -10, y: 15 }),
        slot(c3, 'S', 'FS', { x: 0, y: 11 }, [
          { type: 'zone', zone: 'deep-third-M', dropPoint: { x: 0, y: 16 } },
        ]),
        slot(c3, 'LB', 'LB', { x: -3, y: 5 }, [{ type: 'zone', zone: 'hook-M', dropPoint: { x: 0, y: 6 } }]),
      ],
    },
    now,
  );

  return [flood, mesh, smash, cover1, cover2, cover3];
}
