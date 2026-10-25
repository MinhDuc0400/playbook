import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { flipAction, flipPlay, flipStrength, flipZonePreset } from '../flip';
import { buildRoute } from '../routeTree';
import {
  ZONE_PRESET_IDS,
  SCHEMA_VERSION,
  type Action,
  type MatchRule,
  type PlayerSlot,
  type Play,
  type Point,
  type ReceiverRef,
  type Strength,
  type ZonePresetId,
} from '../types';

// ---------- helpers ----------

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

/** Collect every number in a value (to assert no −0 anywhere). */
function numbers(v: unknown, acc: number[] = []): number[] {
  if (typeof v === 'number') acc.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbers(x, acc));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => numbers(x, acc));
  return acc;
}

const hasNegZero = (v: unknown) => numbers(v).some((n) => Object.is(n, -0));

function mkPlay(partial: Partial<Play> & Pick<Play, 'players'>): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    tags: ['t'],
    createdAt: 1,
    updatedAt: 2,
    ...partial,
  };
}

function slot(
  id: string,
  role: PlayerSlot['role'],
  start: Point,
  rest: Partial<PlayerSlot> = {},
): PlayerSlot {
  return { id, role, label: id, start, actions: [], ...rest };
}

const strongRef = (n: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side: 'strong', number: n });

// ---------- fixtures ----------

const tripsFlood: Play = mkPlay({
  name: 'Trips Flood',
  formation: 'Trips',
  strength: 'right',
  progression: ['z', 'h', 'y'],
  notes: 'flood the right side',
  players: [
    slot('q', 'QB', { x: 0, y: -5 }, { actions: [{ type: 'qbDrop', depth: 5, style: 'shotgun' }] }),
    slot('c', 'C', { x: 0, y: 0 }),
    slot('z', 'WR', { x: 12, y: 0 }, { actions: [buildRoute('go', { x: 12, y: 0 })] }),
    slot('h', 'WR', { x: 8, y: -1 }, { actions: [buildRoute('out', { x: 8, y: -1 }, { depth: 8 })] }),
    slot(
      'y',
      'TE',
      { x: 4, y: -1 },
      {
        actions: [
          { type: 'motion', path: [{ x: 2, y: -1 }], duration: 1 },
          {
            type: 'route',
            path: [
              { x: 2, y: 5 },
              { x: 8, y: 5 },
            ],
            smooth: [false, true],
            delay: 0.2,
            endBehavior: 'stop',
          },
        ],
      },
    ),
    slot('x', 'WR', { x: -12, y: 0 }, { actions: [buildRoute('slant', { x: -12, y: 0 })] }),
  ],
});

const cover1: Play = mkPlay({
  name: 'Cover 1',
  side: 'defense',
  formation: 'Cover 1',
  strength: 'balanced',
  alignTo: 'ball',
  players: [
    slot(
      'fs',
      'S',
      { x: 0, y: 12 },
      { actions: [{ type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 15 } }] },
    ),
    slot(
      'cb1',
      'CB',
      { x: -10, y: 2 },
      { leverage: 'inside', actions: [{ type: 'man', target: strongRef(1), technique: 'trail' }] },
    ),
    slot(
      'cb2',
      'CB',
      { x: 10, y: 2 },
      {
        leverage: 'outside',
        actions: [{ type: 'man', target: { kind: 'role', role: 'RB' }, technique: 'cushion', cushion: 3 }],
      },
    ),
    slot('lb', 'LB', { x: 3, y: 5 }, { actions: [{ type: 'spy', target: { kind: 'role', role: 'QB' } }] }),
    slot(
      'r',
      'R',
      { x: -4, y: 7 },
      {
        actions: [
          {
            type: 'rush',
            path: [
              { x: -2, y: 0 },
              { x: 0, y: -5 },
            ],
          },
        ],
      },
    ),
  ],
});

const cover3: Play = mkPlay({
  name: 'Cover 3',
  side: 'defense',
  formation: 'Cover 3',
  strength: 'left',
  alignTo: 'strength',
  players: [
    slot(
      'cb1',
      'CB',
      { x: -10, y: 7 },
      { actions: [{ type: 'zone', zone: 'deep-third-L', dropPoint: { x: -10, y: 18 } }] },
    ),
    slot(
      'fs',
      'S',
      { x: 0, y: 10 },
      { actions: [{ type: 'zone', zone: 'deep-third-M', dropPoint: { x: 0, y: 18 } }] },
    ),
    slot(
      'cb2',
      'CB',
      { x: 10, y: 7 },
      { actions: [{ type: 'zone', zone: 'deep-third-R', dropPoint: { x: 10, y: 18 } }] },
    ),
    slot(
      'lb',
      'LB',
      { x: -5, y: 5 },
      {
        leverage: 'head-up',
        actions: [
          {
            type: 'zone',
            zone: {
              polygon: [
                { x: -8, y: 3 },
                { x: -2, y: 3 },
                { x: -2, y: 8 },
                { x: -8, y: 8 },
              ],
            },
            dropPoint: { x: -5, y: 6 },
          },
        ],
        matchRules: [
          {
            id: 'm1',
            priority: 2,
            when: { receiver: strongRef(2), event: 'vertical', minDepth: 5 },
            then: { type: 'zone', zone: 'flat-L' },
          },
          {
            id: 'm0',
            priority: 1,
            when: { receiver: strongRef(1), event: 'out', beforeTime: 2 },
            then: { type: 'man', target: strongRef(3) },
          },
          {
            id: 'm2',
            priority: 3,
            when: { receiver: { kind: 'role', role: 'RB' }, event: 'release' },
            then: { type: 'passOff' },
          },
        ],
      },
    ),
  ],
});

// ---------- arbitraries ----------

const coord = fc.integer({ min: -120, max: 120 }).map((n) => n / 4);
const point: fc.Arbitrary<Point> = fc.record({ x: coord, y: coord });
const points = fc.array(point, { minLength: 1, maxLength: 5 });
const ref: fc.Arbitrary<ReceiverRef> = fc.oneof(
  fc.record({
    kind: fc.constant('number' as const),
    side: fc.constantFrom('strong' as const, 'weak' as const),
    number: fc.constantFrom(1 as const, 2 as const, 3 as const),
  }),
  fc.record({
    kind: fc.constant('role' as const),
    role: fc.constantFrom('RB' as const, 'QB' as const, 'C' as const),
  }),
);
const zonePreset = fc.constantFrom<ZonePresetId>(...ZONE_PRESET_IDS);
const optNum = fc.option(
  fc.integer({ min: 0, max: 40 }).map((n) => n / 10),
  { nil: undefined },
);

/** Drops keys whose value is undefined so absent optional fields are truly absent. */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const action: fc.Arbitrary<Action> = fc.oneof(
  fc.record({
    type: fc.constant('motion' as const),
    path: points,
    duration: fc.integer({ min: 1, max: 30 }).map((n) => n / 10),
  }),
  fc
    .record({
      type: fc.constant('route' as const),
      path: points,
      smooth: fc.option(fc.array(fc.boolean(), { maxLength: 5 }), { nil: undefined }),
      templateId: fc.option(fc.constantFrom('slant', 'out', 'go'), { nil: undefined }),
      delay: optNum,
      endBehavior: fc.constantFrom('stop' as const, 'continue' as const),
    })
    .map(clean),
  fc.record({
    type: fc.constant('option' as const),
    stem: points,
    vsMan: points,
    vsZone: points,
    decideAtStemEnd: fc.constant(true as const),
  }),
  fc.record({
    type: fc.constant('qbDrop' as const),
    depth: coord,
    style: fc.constantFrom('shotgun' as const, 'under' as const),
  }),
  fc
    .record({
      type: fc.constant('man' as const),
      target: ref,
      technique: fc.constantFrom('trail' as const, 'cushion' as const),
      cushion: optNum,
    })
    .map(clean),
  fc.record({ type: fc.constant('zone' as const), zone: zonePreset, dropPoint: point }),
  fc.record({ type: fc.constant('zone' as const), zone: fc.record({ polygon: points }), dropPoint: point }),
  fc.record({ type: fc.constant('rush' as const), path: points, delay: fc.constant(0) }).map(clean),
  fc.record({
    type: fc.constant('spy' as const),
    target: fc.constant({ kind: 'role' as const, role: 'QB' as const }),
  }),
);

const matchRule: fc.Arbitrary<MatchRule> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 4 }),
  priority: fc.integer({ min: 0, max: 9 }),
  when: fc
    .record({
      receiver: ref,
      event: fc.constantFrom(
        'vertical' as const,
        'out' as const,
        'in' as const,
        'under' as const,
        'release' as const,
        'stop' as const,
      ),
      minDepth: optNum,
      beforeTime: optNum,
    })
    .map(clean),
  then: fc.oneof(
    fc.record({ type: fc.constant('man' as const), target: ref }),
    fc.record({ type: fc.constant('zone' as const), zone: zonePreset }),
    fc.record({ type: fc.constant('carry' as const) }),
    fc.record({ type: fc.constant('passOff' as const) }),
  ),
});

const slotArb: fc.Arbitrary<PlayerSlot> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 4 }),
    role: fc.constantFrom(
      'QB' as const,
      'WR' as const,
      'RB' as const,
      'CB' as const,
      'LB' as const,
      'R' as const,
    ),
    label: fc.string({ maxLength: 4 }),
    start: point,
    leverage: fc.option(fc.constantFrom('inside' as const, 'outside' as const, 'head-up' as const), {
      nil: undefined,
    }),
    actions: fc.array(action, { maxLength: 3 }),
    matchRules: fc.option(fc.array(matchRule, { maxLength: 3 }), { nil: undefined }),
  })
  .map(clean);

const strengthArb = fc.constantFrom<Strength>('left', 'right', 'balanced');

const playArb: fc.Arbitrary<Play> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 6 }),
    schemaVersion: fc.constant(SCHEMA_VERSION),
    name: fc.string({ maxLength: 8 }),
    side: fc.constantFrom('offense' as const, 'defense' as const),
    format: fc.constantFrom('5v5' as const, '7v7' as const, 'custom' as const),
    formation: fc.string({ maxLength: 8 }),
    strength: strengthArb,
    strengthOverridden: fc.option(fc.boolean(), { nil: undefined }),
    alignTo: fc.option(fc.constantFrom('ball' as const, 'strength' as const), { nil: undefined }),
    players: fc.array(slotArb, { maxLength: 6 }),
    progression: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 3 }), { maxLength: 3 }), {
      nil: undefined,
    }),
    tags: fc.array(fc.string({ maxLength: 4 }), { maxLength: 3 }),
    notes: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
    createdAt: fc.nat(),
    updatedAt: fc.nat(),
  })
  .map(clean);

// ---------- tests ----------

describe('T-DOM-01 flipPlay is an involution', () => {
  it('flipPlay(flipPlay(p)) equals p for any generated play', () => {
    fc.assert(
      fc.property(playArb, (p) => {
        expect(flipPlay(flipPlay(p))).toEqual(p);
      }),
      { numRuns: 300 },
    );
  });

  it('never produces −0 and never mutates a frozen input (generated plays)', () => {
    fc.assert(
      fc.property(playArb, (p) => {
        const frozen = deepFreeze(structuredClone(p));
        const flipped = flipPlay(frozen);
        expect(hasNegZero(flipped)).toBe(false);
        expect(frozen).toEqual(p);
      }),
      { numRuns: 200 },
    );
  });

  it.each([
    ['Trips Flood', tripsFlood],
    ['Cover 1', cover1],
    ['Cover 3', cover3],
  ])('%s: double flip equals the original', (_n, p) => {
    expect(flipPlay(flipPlay(p))).toEqual(p);
    expect(flipPlay(p)).not.toEqual(p);
  });
});

describe('flipPlay table (SRS §6.4)', () => {
  it('mirrors start and every path of Trips Flood, keeping y', () => {
    const f = flipPlay(tripsFlood);
    const z = f.players.find((s) => s.id === 'z')!;
    expect(z.start).toEqual({ x: -12, y: 0 });
    const goOrig = tripsFlood.players.find((s) => s.id === 'z')!.actions[0] as Extract<
      Action,
      { type: 'route' }
    >;
    const go = z.actions[0] as Extract<Action, { type: 'route' }>;
    expect(go.path).toEqual(goOrig.path.map((p) => ({ x: -p.x, y: p.y })));

    const y = f.players.find((s) => s.id === 'y')!;
    expect(y.actions[0]).toEqual({ type: 'motion', path: [{ x: -2, y: -1 }], duration: 1 });
    expect(y.actions[1]).toEqual({
      type: 'route',
      path: [
        { x: -2, y: 5 },
        { x: -8, y: 5 },
      ],
      smooth: [false, true],
      delay: 0.2,
      endBehavior: 'stop',
    });
  });

  it('keeps x = 0 at exactly 0 (not −0)', () => {
    const f = flipPlay(tripsFlood);
    expect(Object.is(f.players.find((s) => s.id === 'q')!.start.x, 0)).toBe(true);
    expect(hasNegZero(f)).toBe(false);
  });

  it('mirrors option stem / vsMan / vsZone', () => {
    const a: Action = {
      type: 'option',
      stem: [{ x: 3, y: 4 }],
      vsMan: [{ x: 6, y: 8 }],
      vsZone: [{ x: -2, y: 9 }],
      decideAtStemEnd: true,
    };
    expect(flipAction(a)).toEqual({
      type: 'option',
      stem: [{ x: -3, y: 4 }],
      vsMan: [{ x: -6, y: 8 }],
      vsZone: [{ x: 2, y: 9 }],
      decideAtStemEnd: true,
    });
  });

  it('mirrors zone polygon and dropPoint; preset zone is swapped', () => {
    const poly = flipAction({
      type: 'zone',
      zone: {
        polygon: [
          { x: 1, y: 2 },
          { x: 5, y: 2 },
          { x: 5, y: 6 },
        ],
      },
      dropPoint: { x: 3, y: 4 },
    });
    expect(poly).toEqual({
      type: 'zone',
      zone: {
        polygon: [
          { x: -1, y: 2 },
          { x: -5, y: 2 },
          { x: -5, y: 6 },
        ],
      },
      dropPoint: { x: -3, y: 4 },
    });
    expect(flipAction({ type: 'zone', zone: 'hook-L', dropPoint: { x: -4, y: 6 } })).toEqual({
      type: 'zone',
      zone: 'hook-R',
      dropPoint: { x: 4, y: 6 },
    });
  });

  it('leaves qbDrop, man and spy unchanged (relative references)', () => {
    const actions: Action[] = [
      { type: 'qbDrop', depth: 5, style: 'under' },
      { type: 'man', target: strongRef(2), technique: 'cushion', cushion: 4 },
      { type: 'spy', target: { kind: 'role', role: 'QB' } },
    ];
    for (const a of actions) expect(flipAction(a)).toEqual(a);
  });

  it('does not add absent optional fields (smooth, templateId, delay, cushion)', () => {
    const r = flipAction({ type: 'route', path: [{ x: 1, y: 1 }], endBehavior: 'continue' });
    expect(Object.keys(r).sort()).toEqual(['endBehavior', 'path', 'type']);
    const m = flipAction({ type: 'man', target: strongRef(1), technique: 'trail' });
    expect(Object.keys(m).sort()).toEqual(['target', 'technique', 'type']);
    const rush = flipAction({ type: 'rush', path: [{ x: 1, y: 1 }] });
    expect(Object.keys(rush).sort()).toEqual(['path', 'type']);
  });

  it('keeps leverage, label, templateId, ReceiverRef, ids, timestamps, tags, notes, progression, alignTo', () => {
    const f = flipPlay(cover1);
    const cb1 = f.players.find((s) => s.id === 'cb1')!;
    expect(cb1.leverage).toBe('inside');
    expect(cb1.label).toBe('cb1');
    expect(cb1.actions[0]).toMatchObject({ type: 'man', target: strongRef(1) });
    expect(f.alignTo).toBe('ball');
    expect(f.createdAt).toBe(cover1.createdAt);
    expect(f.updatedAt).toBe(cover1.updatedAt);

    const g = flipPlay(tripsFlood);
    expect(g.progression).toEqual(['z', 'h', 'y']);
    expect(g.notes).toBe('flood the right side');
    expect(g.tags).toEqual(['t']);
    expect(g.id).toBe(tripsFlood.id);
    const out = g.players.find((s) => s.id === 'h')!.actions[0] as Extract<Action, { type: 'route' }>;
    expect(out.templateId).toBe('out');
  });

  it('maps strength left <-> right and keeps balanced', () => {
    expect(flipStrength('left')).toBe('right');
    expect(flipStrength('right')).toBe('left');
    expect(flipStrength('balanced')).toBe('balanced');
    expect(flipPlay(tripsFlood).strength).toBe('left');
    expect(flipPlay(cover3).strength).toBe('right');
    expect(flipPlay(cover1).strength).toBe('balanced');
  });

  it('maps every zone preset', () => {
    const expected: Record<ZonePresetId, ZonePresetId> = {
      'deep-half-L': 'deep-half-R',
      'deep-half-R': 'deep-half-L',
      'deep-third-L': 'deep-third-R',
      'deep-third-M': 'deep-third-M',
      'deep-third-R': 'deep-third-L',
      'deep-middle': 'deep-middle',
      'flat-L': 'flat-R',
      'flat-R': 'flat-L',
      'hook-L': 'hook-R',
      'hook-R': 'hook-L',
      'hook-M': 'hook-M',
      'curl-flat-L': 'curl-flat-R',
      'curl-flat-R': 'curl-flat-L',
    };
    for (const id of ZONE_PRESET_IDS) expect(flipZonePreset(id)).toBe(expected[id]);
    expect(Object.keys(expected)).toHaveLength(ZONE_PRESET_IDS.length);
  });

  it('mirrors zone presets in matchRules.then, keeps ReceiverRefs, order and priority', () => {
    const f = flipPlay(cover3);
    const lb = f.players.find((s) => s.id === 'lb')!;
    const orig = cover3.players.find((s) => s.id === 'lb')!.matchRules!;
    expect(lb.matchRules!.map((r) => r.id)).toEqual(orig.map((r) => r.id));
    expect(lb.matchRules!.map((r) => r.priority)).toEqual(orig.map((r) => r.priority));
    expect(lb.matchRules![0]).toEqual({
      ...orig[0],
      then: { type: 'zone', zone: 'flat-R' },
    });
    expect(lb.matchRules![0]!.when.receiver).toEqual(strongRef(2));
    expect(lb.matchRules![1]).toEqual(orig[1]);
    expect(lb.matchRules![2]).toEqual(orig[2]);
  });

  it('swaps Cover 3 deep thirds and mirrors their drop points', () => {
    const f = flipPlay(cover3);
    const cb1 = f.players.find((s) => s.id === 'cb1')!;
    expect(cb1.start).toEqual({ x: 10, y: 7 });
    expect(cb1.actions[0]).toEqual({ type: 'zone', zone: 'deep-third-R', dropPoint: { x: 10, y: 18 } });
    const fs = f.players.find((s) => s.id === 'fs')!;
    expect(fs.actions[0]).toEqual({ type: 'zone', zone: 'deep-third-M', dropPoint: { x: 0, y: 18 } });
  });

  it('returns a new object and does not mutate a frozen input', () => {
    const frozen = deepFreeze(structuredClone(cover3));
    const snapshot = structuredClone(cover3);
    const f = flipPlay(frozen);
    expect(f).not.toBe(frozen);
    expect(f.players).not.toBe(frozen.players);
    expect(frozen).toEqual(snapshot);
    expect(hasNegZero(f)).toBe(false);
  });
});

describe('T-DOM-06 slant stays inside after flip', () => {
  it('left receiver slant goes inside (x increases); after flip the receiver is at x=10 and x decreases', () => {
    const start = { x: -10, y: -1 };
    const route = buildRoute('slant', start);
    const play = mkPlay({ players: [slot('x', 'WR', start, { actions: [route] })] });

    const lastX = (r: Extract<Action, { type: 'route' }>) => r.path[r.path.length - 1]!.x;
    expect(lastX(route)).toBeGreaterThan(start.x);

    const f = flipPlay(play);
    const fx = f.players[0]!;
    expect(fx.start.x).toBe(10);
    const fr = fx.actions[0] as Extract<Action, { type: 'route' }>;
    expect(lastX(fr)).toBeLessThan(10);
    expect(fr.templateId).toBe('slant');
    // every break point moves inside (toward the ball) or stays
    for (let i = 1; i < fr.path.length; i++) expect(fr.path[i]!.x).toBeLessThanOrEqual(fr.path[i - 1]!.x);
  });
});
