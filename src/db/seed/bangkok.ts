/**
 * Ready-made "Bunch Killer (Bangkok)" content (D-42, D-40): a tight Bunch offense, the Rush and No Rush Spy
 * area-match defenses from the user's diagrams, four red-zone matchups (ball on the 5) and an Install.
 * Fixed ids so seeding can check what is missing and never duplicate.
 */
import {
  SCHEMA_VERSION,
  type Action,
  type FieldConfig,
  type ID,
  type Install,
  type Matchup,
  type Play,
  type PlayerSlot,
  type Point,
} from '@/domain/types';
import { center, offensePlay, SEED_IDS, slot, wr } from './samplePlays';

export const BANGKOK_IDS = {
  bunchTight: 'seed-off-bunch-tight',
  rush: 'seed-def-bangkok-rush',
  spy: 'seed-def-bangkok-spy',
  install: 'seed-install-bangkok',
  matchups: [
    'seed-mu-bangkok-rush-bunch',
    'seed-mu-bangkok-spy-bunch',
    'seed-mu-bangkok-rush-flood',
    'seed-mu-bangkok-spy-flood',
  ],
} as const;

const RUSH_NAME = 'Zone: Bunch Killer (Bangkok) Rush';
const SPY_NAME = 'Zone: Bunch Killer (Bangkok) No Rush Spy';
const INSTALL_NAME = 'Red Zone – Bunch Killer (Bangkok)';
/** Yards from the goal line the matchups are spotted at. */
const RED_ZONE_YARDS = 5;

const polygonZone = (polygon: Point[], dropPoint: Point): Action => ({
  type: 'zone',
  zone: { polygon },
  dropPoint,
});

/** The four area-match defenders shared by both plays (spec §7, measured from the diagrams). */
function coverage(playId: ID): PlayerSlot[] {
  const cb2 = slot(playId, 'CB', 'CB2', { x: -8, y: 3.5 }, [], 'outside');
  const lb = slot(
    playId,
    'LB',
    'LB',
    { x: -1.5, y: 3.5 },
    [
      polygonZone(
        [
          { x: -4.8, y: 0 },
          { x: 1.4, y: 0 },
          { x: -1.3, y: 6.5 },
        ],
        { x: -1.3, y: 3 },
      ),
    ],
    'inside',
  );
  const s = slot(
    playId,
    'S',
    'S',
    { x: 4, y: 3.5 },
    [
      polygonZone(
        [
          { x: -0.6, y: 0 },
          { x: 4.8, y: 0 },
          { x: 4.8, y: 6 },
        ],
        { x: 3.5, y: 3 },
      ),
    ],
    'inside',
  );
  const cb1 = slot(playId, 'CB', 'CB1', { x: 9, y: 3.5 }, [], 'outside');
  return [
    { ...cb2, areaMatch: { role: 'corner' } },
    { ...lb, areaMatch: { role: 'inside' } },
    { ...s, areaMatch: { role: 'inside' } },
    { ...cb1, areaMatch: { role: 'corner' } },
  ];
}

/** Spy R's zone "MID": x −6..7, from just past the LOS to the back of the end zone with the ball on the 5 (D-44). */
export function spyZone(field: FieldConfig): Action {
  const back = RED_ZONE_YARDS + field.endZoneDepth;
  return polygonZone(
    [
      { x: -6, y: 1.5 },
      { x: 7, y: 1.5 },
      { x: 7, y: back },
      { x: -6, y: back },
    ],
    { x: 0.5, y: 5 },
  );
}

/** Spy R's zone as seed v2 wrote it (stopped 10 yd past the LOS); seed v3 replaces it when untouched. */
export const SPY_ZONE_V2: Action = polygonZone(
  [
    { x: -6, y: 1.5 },
    { x: 7, y: 1.5 },
    { x: 7, y: 10 },
    { x: -6, y: 10 },
  ],
  { x: 0.5, y: 5 },
);

function defensePlay(id: ID, name: string, r: PlayerSlot, now: number): Play {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name,
    side: 'defense',
    format: '5v5',
    formation: 'Bunch Killer',
    strength: 'right',
    alignTo: 'ball',
    players: [...coverage(id), r],
    tags: ['cov:zone', 'cov:match', 'red-zone', 'vs:bunch', 'vs:trips'],
    notes:
      'CB nhận receiver đầu tiên vào làn của mình; không ai vào thì squeeze vào trong. ' +
      'LB/S bỏ qua receiver đầu tiên ra ngoài, nhận người thứ hai; không ai ra ngoài thì đá zone người còn lại.',
    createdAt: now,
    updatedAt: now,
  };
}

function matchup(id: ID, defensePlayId: ID, offensePlayId: ID, yardLine: number, now: number): Matchup {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    offensePlayId,
    offenseFlipped: false,
    defensePlayId,
    defenseFlip: 'auto',
    overrides: [],
    anticipation: 0.5,
    ballSpot: { x: 0, yardLine },
    seed: 1,
    noise: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBangkokContent(
  now: number,
  field: FieldConfig,
): { plays: Play[]; matchups: Matchup[]; install: Install } {
  const b = BANGKOK_IDS.bunchTight;
  const bunch = offensePlay(
    {
      id: b,
      name: 'Bunch Tight',
      formation: 'Bunch',
      strength: 'right',
      tags: ['red-zone', 'concept:bunch'],
      c: center(b, 'go', 10, 1),
      receivers: [wr(b, 'X', -3, 'slant', 3), wr(b, 'Y', 3, 'flat', 1), wr(b, 'Z', 6, 'corner', 5)],
      progression: ['Y', 'Z', 'X', 'C'],
    },
    now,
  );
  // offensePlay puts C before the receivers; order the slots left to right like the diagram.
  const order = ['Q', 'X', 'C', 'Y', 'Z'];
  bunch.players.sort((a, c) => order.indexOf(a.label) - order.indexOf(c.label));

  const rush = defensePlay(
    BANGKOK_IDS.rush,
    RUSH_NAME,
    slot(BANGKOK_IDS.rush, 'R', 'R', { x: -7, y: 7 }, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]),
    now,
  );
  const spy = defensePlay(
    BANGKOK_IDS.spy,
    SPY_NAME,
    slot(BANGKOK_IDS.spy, 'R', 'R', { x: 0.5, y: 7 }, [spyZone(field)]),
    now,
  );

  const yardLine = field.length - RED_ZONE_YARDS;
  const [m1, m2, m3, m4] = BANGKOK_IDS.matchups;
  const matchups = [
    matchup(m1, rush.id, bunch.id, yardLine, now),
    matchup(m2, spy.id, bunch.id, yardLine, now),
    matchup(m3, rush.id, SEED_IDS.flood, yardLine, now),
    matchup(m4, spy.id, SEED_IDS.flood, yardLine, now),
  ];
  const install: Install = {
    id: BANGKOK_IDS.install,
    schemaVersion: SCHEMA_VERSION,
    name: INSTALL_NAME,
    description: 'Red zone (≤ 5 yd, no-run zone) vs Bunch / Trips.',
    items: matchups.map((m, i) => ({
      id: `${BANGKOK_IDS.install}-item-${i + 1}`,
      matchupId: m.id,
      order: i,
    })),
    createdAt: now,
    updatedAt: now,
  };
  return { plays: [bunch, rush, spy], matchups, install };
}
