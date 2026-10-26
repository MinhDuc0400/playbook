import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { createDefaultFields, fieldBounds, sidelineBounds } from '@/domain/field';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { buildRoute, type RouteTemplateId } from '@/domain/routeTree';
import { SCHEMA_VERSION, STAT_KEYS } from '@/domain/types';
import type {
  Action,
  ID,
  Play,
  PlayerSlot,
  Point,
  ReceiverRef,
  Role,
  SimInput,
  Side,
  Stats,
} from '@/domain/types';
import { zonePreset } from '@/domain/zones';
import { UNIT_STATS, prepareSim } from '../prepare';

const field = createDefaultFields()['5v5'];
const ballSpot = { x: 0, yardLine: 15 };

function slot(id: ID, role: Role, label: string, x: number, y: number, actions: Action[] = []): PlayerSlot {
  return { id, role, label, start: { x, y } satisfies Point, actions };
}

function play(side: Side, players: PlayerSlot[]): Play {
  return {
    id: `${side}-play`,
    schemaVersion: SCHEMA_VERSION,
    name: 't',
    side,
    format: '5v5',
    formation: 'T',
    strength: 'right',
    players,
    tags: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

const num = (side: 'strong' | 'weak', number: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side, number });
const man = (target: ReceiverRef, extra: Partial<Extract<Action, { type: 'man' }>> = {}): Action => ({
  type: 'man',
  target,
  technique: 'trail',
  ...extra,
});

function routeSlot(id: string, x: number, templateId: RouteTemplateId): PlayerSlot {
  const start = { x, y: -1 };
  const outward = x >= 0 ? 1 : -1;
  return slot(id, 'WR', id, x, -1, [buildRoute(templateId, start, { outward })]);
}

/** Trips right: Z 12, Y 8, H 4.5; QB and C. Z/Y have routes, H has none. */
function tripsOffense(): Play {
  return play('offense', [
    slot('qb', 'QB', 'Q', 0, -5, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]),
    slot('c', 'C', 'C', 0, -0.5),
    routeSlot('Z', 12, 'go'),
    routeSlot('Y', 8, 'slant'),
    slot('H', 'WR', 'H', 4.5, -1),
  ]);
}

function coverDefense(): Play {
  return play('defense', [
    slot('cb1', 'CB', 'CB1', 11, 5, [man(num('strong', 1), { technique: 'cushion' })]),
    slot('lb', 'LB', 'LB', 5, 4, [man(num('strong', 2), { technique: 'trail' })]),
    slot('cb2', 'CB', 'CB2', -11, 5, [man(num('strong', 3), { technique: 'cushion', cushion: 3 })]),
    slot('fs', 'S', 'FS', 0, 12, [{ type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 14 } }]),
    slot('fl', 'LB', 'FL', -6, 4, [{ type: 'zone', zone: 'flat-L', dropPoint: { x: -10, y: 5 } }]),
    slot('r1', 'R', 'R1', 0, 7, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]),
    slot('sp', 'LB', 'SP', 2, 6, [{ type: 'spy', target: { kind: 'role', role: 'QB' } }]),
    slot('idle', 'S', 'ID', 3, 9),
  ]);
}

function inputOf(over: Partial<SimInput> = {}): SimInput {
  return {
    offense: tripsOffense(),
    defense: coverDefense(),
    offenseStats: {},
    defenseStats: {},
    field,
    ballSpot,
    anticipation: 0.5,
    seed: 42,
    noise: false,
    tuning: DEFAULT_TUNING,
    routePriors: {},
    ...over,
  };
}

const customStats = (v: number): Stats => {
  const s = { ...DEFAULT_PRESETS.avg };
  for (const k of STAT_KEYS) s[k] = DEFAULT_PRESETS.avg[k] * v;
  return s;
};

describe('prepareSim info and numbering', () => {
  it('computes sideline and end-zone bounds from field and ball spot', () => {
    const spot = { x: 3, yardLine: 20 };
    const p = prepareSim(inputOf({ ballSpot: spot }));
    const sl = sidelineBounds(field, spot);
    const fb = fieldBounds(field, spot);
    expect(p.info).toMatchObject({
      minX: sl.minX,
      maxX: sl.maxX,
      minY: fb.minY,
      maxY: fb.maxY,
      ballSpot: spot,
    });
    expect(p.info.minX).toBe(-18);
    expect(p.info.maxX).toBe(12);
    expect(p.info.field).toBe(field);
    expect(p.info.tuning).toBe(DEFAULT_TUNING);
  });

  it('numbers receivers from alignment and reports qb id', () => {
    const p = prepareSim(inputOf());
    expect(p.numbering.strength).toBe('right');
    expect(p.numbering.strong).toEqual(['Z', 'Y', 'H']);
    expect(p.numbering.weak).toEqual([]);
    expect(p.qbId).toBe('qb');
  });

  it('uses computed strength, not Play.strength, for numbering', () => {
    const offense = { ...tripsOffense(), strength: 'left' as const };
    expect(prepareSim(inputOf({ offense })).numbering.strong).toEqual(['Z', 'Y', 'H']);
  });

  it('qbId is null when the offense has no QB', () => {
    const offense = play('offense', [routeSlot('Z', 12, 'go')]);
    expect(prepareSim(inputOf({ offense })).qbId).toBeNull();
  });
});

describe('prepareSim bindings', () => {
  it('binds man defenders to slot ids with technique and default cushion', () => {
    const { bindings } = prepareSim(inputOf());
    expect(bindings.cb1).toEqual({ kind: 'man', targetId: 'Z', technique: 'cushion', cushion: 5 });
    expect(bindings.lb).toEqual({ kind: 'man', targetId: 'Y', technique: 'trail', cushion: 0 });
    expect(bindings.cb2).toEqual({ kind: 'man', targetId: 'H', technique: 'cushion', cushion: 3 });
  });

  it('binds zone defenders with polygon, drop point and deep flag', () => {
    const { bindings } = prepareSim(inputOf());
    const deep = zonePreset('deep-middle', field);
    expect(bindings.fs).toEqual({
      kind: 'zone',
      polygon: deep.polygon,
      dropPoint: { x: 0, y: 14 },
      deep: true,
      fallback: false,
    });
    const flat = bindings.fl;
    expect(flat).toMatchObject({ kind: 'zone', deep: false, fallback: false });
    expect(flat?.kind === 'zone' && flat.polygon).toEqual(zonePreset('flat-L', field).polygon);
  });

  it('custom polygon zone is copied; deep when min y >= 8', () => {
    const polygon = [
      { x: -2, y: 9 },
      { x: 2, y: 9 },
      { x: 2, y: 20 },
      { x: -2, y: 20 },
    ];
    const defense = play('defense', [
      slot('z', 'S', 'S1', 0, 12, [{ type: 'zone', zone: { polygon }, dropPoint: { x: 0, y: 15 } }]),
    ]);
    const b = prepareSim(inputOf({ defense })).bindings.z;
    expect(b).toMatchObject({ kind: 'zone', deep: true, fallback: false });
    expect(b?.kind === 'zone' && b.polygon).toEqual(polygon);
    expect(b?.kind === 'zone' && b.polygon).not.toBe(polygon);
  });

  it('rush binding keeps path and defaults delay to 0; spy binds the QB; no action → none', () => {
    const defense = play('defense', [
      slot('r', 'R', 'R1', 0, 7, [
        {
          type: 'rush',
          path: [
            { x: 1, y: 3 },
            { x: 0, y: -5 },
          ],
        },
      ]),
      slot('sp', 'LB', 'SP', 2, 6, [{ type: 'spy', target: { kind: 'role', role: 'QB' } }]),
      slot('x', 'S', 'X', 3, 9),
    ]);
    const { bindings } = prepareSim(inputOf({ defense }));
    expect(bindings.r).toEqual({
      kind: 'rush',
      path: [
        { x: 1, y: 3 },
        { x: 0, y: -5 },
      ],
      delay: 0,
    });
    expect(bindings.sp).toEqual({ kind: 'spy', targetId: 'qb' });
    expect(bindings.x).toEqual({ kind: 'none' });
    expect(Object.keys(bindings).sort()).toEqual(['r', 'sp', 'x']);
  });

  it('uses the first coverage/rush action of a slot', () => {
    const defense = play('defense', [
      slot('a', 'CB', 'CB1', 11, 5, [
        { type: 'zone', zone: 'flat-R', dropPoint: { x: 10, y: 5 } },
        man(num('strong', 1)),
      ]),
    ]);
    expect(prepareSim(inputOf({ defense })).bindings.a?.kind).toBe('zone');
  });

  it('role refs: QB and C resolve to their slots', () => {
    const defense = play('defense', [
      slot('a', 'LB', 'LB', 0, 5, [man({ kind: 'role', role: 'C' })]),
      slot('b', 'LB', 'LB2', 2, 5, [man({ kind: 'role', role: 'QB' })]),
    ]);
    const { bindings } = prepareSim(inputOf({ defense }));
    expect(bindings.a).toMatchObject({ kind: 'man', targetId: 'c' });
    expect(bindings.b).toMatchObject({ kind: 'man', targetId: 'qb' });
  });
});

describe('T-ENG-10 missing ReceiverRef falls back to zone', () => {
  it('man on weak #2 with no weak receivers → hook zone on the defender side, warning, no throw', () => {
    const defense = play('defense', [
      slot('left', 'CB', 'CB2', -11, 5, [man(num('weak', 2))]),
      slot('right', 'CB', 'CB1', 11, 5, [man(num('weak', 2))]),
      slot('mid', 'LB', 'LB', 0, 5, [man(num('weak', 3))]),
    ]);
    const bad = tripsOffense();
    const input = inputOf({ defense, offense: { ...bad, players: bad.players.filter((s) => s.id !== 'H') } });
    const p = prepareSim(input);
    const hookL = zonePreset('hook-L', field);
    expect(p.bindings.left).toEqual({
      kind: 'zone',
      polygon: hookL.polygon,
      dropPoint: hookL.dropPoint,
      deep: false,
      fallback: true,
    });
    expect(p.bindings.right).toMatchObject({ kind: 'zone', fallback: true });
    const r = p.bindings.right;
    expect(r?.kind === 'zone' && r.polygon).toEqual(zonePreset('hook-R', field).polygon);
    const m = p.bindings.mid;
    expect(m?.kind === 'zone' && m.polygon).toEqual(zonePreset('hook-M', field).polygon);
    expect(p.warnings).toHaveLength(3);
    expect(p.warnings.some((w) => w.includes('CB2') && w.includes('weak #2') && w.includes('hook-L'))).toBe(
      true,
    );
    expect(p.warnings.some((w) => w.includes('CB1') && w.includes('hook-R'))).toBe(true);
    expect(p.warnings.some((w) => w.includes('LB') && w.includes('hook-M'))).toBe(true);
  });

  it('role RB with no backfield RB falls back to zone with a warning', () => {
    const defense = play('defense', [slot('d', 'LB', 'LB', -4, 5, [man({ kind: 'role', role: 'RB' })])]);
    const p = prepareSim(inputOf({ defense }));
    expect(p.bindings.d).toMatchObject({ kind: 'zone', fallback: true, deep: false });
    expect(p.warnings).toEqual([expect.stringContaining('LB')]);
    expect(p.warnings[0]).toContain('RB');
  });

  it('a present backfield RB binds normally without warnings', () => {
    const offense = play('offense', [
      slot('qb', 'QB', 'Q', 0, -5),
      slot('rb', 'RB', 'B', -1.5, -5),
      routeSlot('Z', 12, 'go'),
    ]);
    const defense = play('defense', [slot('d', 'LB', 'LB', -4, 5, [man({ kind: 'role', role: 'RB' })])]);
    const p = prepareSim(inputOf({ offense, defense }));
    expect(p.bindings.d).toMatchObject({ kind: 'man', targetId: 'rb' });
    expect(p.warnings).toEqual([]);
  });

  it('no warnings when every target exists', () => {
    expect(prepareSim(inputOf()).warnings).toEqual([]);
  });
});

describe('prepareSim stats', () => {
  it('missing stats default to the avg preset; given stats are copied exactly (noise off)', () => {
    const given = customStats(1.3);
    const p = prepareSim(inputOf({ offenseStats: { Z: given }, defenseStats: { cb1: customStats(0.8) } }));
    expect(p.stats.Z).toEqual(given);
    expect(p.stats.Z).not.toBe(given);
    expect(p.stats.cb1).toEqual(customStats(0.8));
    expect(p.stats.Y).toEqual(DEFAULT_PRESETS.avg);
    expect(p.stats.r1).toEqual(DEFAULT_PRESETS.avg);
    expect(Object.keys(p.stats).sort()).toEqual(
      [...tripsOffense().players, ...coverDefense().players].map((s) => s.id).sort(),
    );
  });

  it('noise on: every stat within [0.9, 1.1] x input, unit stats clamped to [0, 1]', () => {
    const high: Stats = { ...DEFAULT_PRESETS.good, cutLoss: 0.99, iq: 1, hands: 1, accuracy: 0.98 };
    const p = prepareSim(inputOf({ noise: true, offenseStats: { Z: high }, defenseStats: {} }));
    let changed = 0;
    for (const [id, base] of [
      ['Z', high],
      ['Y', DEFAULT_PRESETS.avg],
      ['cb1', DEFAULT_PRESETS.avg],
    ] as const) {
      const out = p.stats[id] as Stats;
      for (const k of STAT_KEYS) {
        const isUnit = (UNIT_STATS as readonly string[]).includes(k);
        const lo = base[k] * 0.9;
        const hi = base[k] * 1.1;
        if (isUnit) {
          expect(out[k]).toBeGreaterThanOrEqual(Math.min(lo, 1));
          expect(out[k]).toBeLessThanOrEqual(1);
        } else {
          expect(out[k]).toBeGreaterThanOrEqual(lo);
          expect(out[k]).toBeLessThanOrEqual(hi);
        }
        if (out[k] !== base[k]) changed += 1;
      }
    }
    expect(changed).toBeGreaterThan(20);
  });

  it('noise keeps unit stats in [0, 1] over many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = prepareSim(inputOf({ noise: true, seed, offenseStats: { Z: DEFAULT_PRESETS.good } })).stats
        .Z as Stats;
      for (const k of UNIT_STATS) {
        expect(s[k]).toBeGreaterThanOrEqual(0);
        expect(s[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('noise is deterministic per seed, differs per slot and per seed', () => {
    const a = prepareSim(inputOf({ noise: true, seed: 7 }));
    const b = prepareSim(inputOf({ noise: true, seed: 7 }));
    const c = prepareSim(inputOf({ noise: true, seed: 8 }));
    expect(b.stats).toEqual(a.stats);
    expect(c.stats.Z).not.toEqual(a.stats.Z);
    expect(a.stats.Z).not.toEqual(a.stats.Y); // same input stats, different slot → different noise
  });

  it('noise on one slot does not depend on which other slots exist', () => {
    const full = prepareSim(inputOf({ noise: true }));
    const offense = tripsOffense();
    const reduced = prepareSim(
      inputOf({ noise: true, offense: { ...offense, players: offense.players.filter((s) => s.id !== 'Y') } }),
    );
    expect(reduced.stats.Z).toEqual(full.stats.Z);
  });
});

describe('prepareSim plans', () => {
  it('has plans only for offense slots with a route', () => {
    const p = prepareSim(inputOf());
    expect(Object.keys(p.plans).sort()).toEqual(['Y', 'Z']);
    const z = tripsOffense().players.find((s) => s.id === 'Z') as PlayerSlot;
    const route = z.actions[0] as Extract<Action, { type: 'route' }>;
    expect(p.plans.Z?.slotId).toBe('Z');
    expect(p.plans.Z?.start).toEqual({ x: 12, y: -1 });
    expect(p.plans.Z?.waypoints).toEqual(route.path);
    expect(p.plans.Z?.endBehavior).toBe(route.endBehavior);
  });

  it('skips routes with an empty path', () => {
    const offense = play('offense', [
      slot('qb', 'QB', 'Q', 0, -5),
      slot('Z', 'WR', 'Z', 12, -1, [{ type: 'route', path: [], endBehavior: 'stop' }]),
    ]);
    expect(prepareSim(inputOf({ offense })).plans).toEqual({});
  });

  it('passes offense and defense through unchanged', () => {
    const input = inputOf();
    const p = prepareSim(input);
    expect(p.offense).toBe(input.offense);
    expect(p.defense).toBe(input.defense);
  });
});
