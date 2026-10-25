import { describe, expect, it } from 'vitest';
import { flipPlay } from '@/domain/flip';
import { SCHEMA_VERSION, type Play, type PlayerSlot, type Point, type RouteAction } from '@/domain/types';
import {
  addPlayer,
  applyRouteTemplate,
  canAddPlayer,
  clearProgression,
  deleteRoutePoint,
  duplicatePlayer,
  flip,
  getRoute,
  insertRoutePoint,
  moveRoutePoint,
  movePlayer,
  refreshStrength,
  removePlayers,
  setLabel,
  setMeta,
  setQbDrop,
  setRoute,
  setRouteEndBehavior,
  setStrength,
  toggleProgression,
  toggleRoutePointSmooth,
  type Recipe,
} from '../ops';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

function slot(
  id: string,
  role: PlayerSlot['role'],
  start: Point,
  actions: PlayerSlot['actions'] = [],
  label = id,
): PlayerSlot {
  return { id, role, label, start, actions };
}

function mkPlay(players: PlayerSlot[], rest: Partial<Play> = {}): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    tags: ['a'],
    createdAt: 1,
    updatedAt: 2,
    ...rest,
    players,
  };
}

const route = (path: Point[], extra: Partial<RouteAction> = {}): RouteAction => ({
  type: 'route',
  path,
  endBehavior: 'continue',
  ...extra,
});

/** QB, C, X left, Z right, Y right (2 right vs 1 left => strength right). */
function offense(): Play {
  return mkPlay([
    slot('q', 'QB', { x: 0, y: -5 }, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }], 'Q'),
    slot('c', 'C', { x: 0, y: 0 }, [], 'C'),
    slot('x', 'WR', { x: -8, y: 0 }, [route([{ x: -8, y: 10 }])], 'X'),
    slot('z', 'WR', { x: 8, y: 0 }, [], 'Z'),
    slot('y', 'WR', { x: 4, y: 0 }, [], 'Y'),
  ]);
}

function defense(): Play {
  return mkPlay(
    [
      slot('cb', 'CB', { x: -8, y: 5 }, [{ type: 'zone', zone: 'flat-L', dropPoint: { x: -8, y: 7 } }]),
      slot('r', 'R', { x: 2, y: 7 }, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]),
    ],
    { side: 'defense', alignTo: 'ball' },
  );
}

let n = 0;
const idGen = () => `n${++n}`;

/** Run every recipe on a deep-frozen play; a mutation would throw in strict mode. */
function run(play: Play, recipe: Recipe): Play {
  return recipe(deepFreeze(structuredClone(play)));
}

const slotOf = (p: Play, id: string): PlayerSlot => {
  const s = p.players.find((x) => x.id === id);
  if (!s) throw new Error(`no slot ${id}`);
  return s;
};

describe('addPlayer / canAddPlayer (FR-ED-02)', () => {
  it('assigns default labels in pool order (X then Z ...)', () => {
    let p = mkPlay([]);
    p = run(p, addPlayer('WR', { x: -8, y: 0 }, 5, idGen));
    p = run(p, addPlayer('WR', { x: 8, y: 0 }, 5, idGen));
    p = run(p, addPlayer('WR', { x: 4, y: 0 }, 5, idGen));
    expect(p.players.map((s) => s.label)).toEqual(['X', 'Z', 'Y']);
    expect(new Set(p.players.map((s) => s.id)).size).toBe(3);
  });

  it('reuses a freed label', () => {
    let p = offense();
    p = run(p, removePlayers(['x']));
    p = run(p, addPlayer('WR', { x: -9, y: 0 }, 5, idGen));
    expect(slotOf(p, p.players[p.players.length - 1]!.id).label).toBe('X');
  });

  it('is a no-op (same object) at max players', () => {
    const p = offense(); // 5 players
    expect(canAddPlayer(p, 5)).toBe(false);
    expect(canAddPlayer(p, 6)).toBe(true);
    expect(addPlayer('WR', { x: 1, y: 0 }, 5, idGen)(p)).toBe(p);
  });

  it('gives a QB qbDrop {2, shotgun}', () => {
    const p = run(mkPlay([]), addPlayer('QB', { x: 0, y: -5 }, 5, idGen));
    expect(p.players[0]?.label).toBe('Q');
    expect(p.players[0]?.actions).toEqual([{ type: 'qbDrop', depth: 2, style: 'shotgun' }]);
  });

  it('gives a defense R a rush to (0,-5) with delay 0', () => {
    const p = run(defense(), addPlayer('R', { x: -2, y: 7 }, 5, idGen));
    const added = p.players[p.players.length - 1]!;
    expect(added.label).toBe('R1');
    expect(added.actions).toEqual([{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);
  });

  it('does not touch strength on defense', () => {
    const p = run(defense(), addPlayer('CB', { x: 8, y: 5 }, 5, idGen));
    expect(p.strength).toBe('right');
  });

  it('recomputes strength when a receiver is added (FR-OFF-05)', () => {
    const p = run(offense(), removePlayers(['y', 'z'])); // only X on the left
    expect(p.strength).toBe('left');
    const q = run(p, addPlayer('WR', { x: 9, y: 0 }, 5, idGen));
    expect(q.strength).toBe('balanced');
  });
});

describe('movePlayer (D-18)', () => {
  it('translates the offense route by the same delta, keeping its shape', () => {
    const p = run(offense(), movePlayer('x', { x: -6, y: 1 }));
    const x = slotOf(p, 'x');
    expect(x.start).toEqual({ x: -6, y: 1 });
    expect(x.actions).toEqual([route([{ x: -6, y: 11 }])]);
  });

  it('translates option and motion points too, leaves qbDrop alone', () => {
    const base = mkPlay([
      slot('w', 'WR', { x: 8, y: 0 }, [
        { type: 'motion', path: [{ x: 4, y: 0 }], duration: 1 },
        {
          type: 'option',
          stem: [{ x: 8, y: 5 }],
          vsMan: [{ x: 10, y: 8 }],
          vsZone: [{ x: 6, y: 8 }],
          decideAtStemEnd: true,
        },
      ]),
      slot('q', 'QB', { x: 0, y: -5 }, [{ type: 'qbDrop', depth: 2, style: 'under' }]),
    ]);
    const p = run(base, movePlayer('w', { x: 9, y: 0 }));
    expect(slotOf(p, 'w').actions).toEqual([
      { type: 'motion', path: [{ x: 5, y: 0 }], duration: 1 },
      {
        type: 'option',
        stem: [{ x: 9, y: 5 }],
        vsMan: [{ x: 11, y: 8 }],
        vsZone: [{ x: 7, y: 8 }],
        decideAtStemEnd: true,
      },
    ]);
    const q = run(base, movePlayer('q', { x: 1, y: -6 }));
    expect(slotOf(q, 'q').actions).toEqual([{ type: 'qbDrop', depth: 2, style: 'under' }]);
  });

  it('leaves defense zone and rush untouched', () => {
    const p = run(defense(), movePlayer('cb', { x: -6, y: 6 }));
    expect(slotOf(p, 'cb').start).toEqual({ x: -6, y: 6 });
    expect(slotOf(p, 'cb').actions).toEqual(slotOf(defense(), 'cb').actions);
    const q = run(defense(), movePlayer('r', { x: 3, y: 8 }));
    expect(slotOf(q, 'r').actions).toEqual(slotOf(defense(), 'r').actions);
  });

  it('returns the same object for an unknown id or an unchanged position', () => {
    const p = offense();
    expect(movePlayer('nope', { x: 1, y: 1 })(p)).toBe(p);
    expect(movePlayer('x', { x: -8, y: 0 })(p)).toBe(p);
  });

  it('recomputes strength when a receiver crosses the ball', () => {
    const p = run(offense(), movePlayer('y', { x: -4, y: 0 })); // 1 right, 2 left
    expect(p.strength).toBe('left');
  });

  it('keeps an overridden strength', () => {
    const base = { ...offense(), strengthOverridden: true };
    const p = run(base, movePlayer('y', { x: -4, y: 0 }));
    expect(p.strength).toBe('right');
  });
});

describe('removePlayers', () => {
  it('removes players and drops them from progression', () => {
    const base = { ...offense(), progression: ['x', 'z', 'y'] };
    const p = run(base, removePlayers(['z', 'nope']));
    expect(p.players.map((s) => s.id)).toEqual(['q', 'c', 'x', 'y']);
    expect(p.progression).toEqual(['x', 'y']);
  });

  it('is a no-op when no id matches', () => {
    const p = offense();
    expect(removePlayers(['nope'])(p)).toBe(p);
  });

  it('recomputes strength', () => {
    const p = run(offense(), removePlayers(['z', 'y']));
    expect(p.strength).toBe('left');
  });
});

describe('duplicatePlayer (Ctrl+D)', () => {
  it('copies with +1 yd in x, a new id and the next default label', () => {
    const p = run(offense(), duplicatePlayer('x', 6, idGen));
    const copy = p.players[p.players.length - 1]!;
    expect(copy.id).not.toBe('x');
    expect(copy.label).toBe('H'); // X, Z, Y taken -> next in the WR pool... Z and Y exist as labels, so H
    expect(copy.role).toBe('WR');
    expect(copy.start).toEqual({ x: -7, y: 0 });
    expect(copy.actions).toEqual([route([{ x: -7, y: 10 }])]);
    expect(slotOf(p, 'x').start).toEqual({ x: -8, y: 0 });
  });

  it('is a no-op at max players or for an unknown id', () => {
    const p = offense();
    expect(duplicatePlayer('x', 5, idGen)(p)).toBe(p);
    expect(duplicatePlayer('nope', 6, idGen)(p)).toBe(p);
  });
});

describe('setLabel', () => {
  it('renames, and is a no-op when unchanged', () => {
    const p = run(offense(), setLabel('x', 'W'));
    expect(slotOf(p, 'x').label).toBe('W');
    const q = offense();
    expect(setLabel('x', 'X')(q)).toBe(q);
  });
});

describe('route editing (FR-OFF-02)', () => {
  const withRoute = (extra: Partial<RouteAction> = {}): Play =>
    mkPlay([
      slot('w', 'WR', { x: 8, y: 0 }, [
        route(
          [
            { x: 8, y: 5 },
            { x: 12, y: 5 },
            { x: 12, y: 10 },
          ],
          { smooth: [false, true, false], templateId: 'out', ...extra },
        ),
      ]),
    ]);

  it('getRoute returns the first route action', () => {
    expect(getRoute(offense(), 'x')?.path).toEqual([{ x: -8, y: 10 }]);
    expect(getRoute(offense(), 'z')).toBeUndefined();
    expect(getRoute(offense(), 'nope')).toBeUndefined();
  });

  it('setRoute replaces, appends and removes', () => {
    const r = route([{ x: 8, y: 7 }]);
    const replaced = run(offense(), setRoute('x', r));
    expect(slotOf(replaced, 'x').actions).toEqual([r]);
    const appended = run(offense(), setRoute('z', r));
    expect(slotOf(appended, 'z').actions).toEqual([r]);
    const removed = run(offense(), setRoute('x', null));
    expect(slotOf(removed, 'x').actions).toEqual([]);
    const p = offense();
    expect(setRoute('z', null)(p)).toBe(p);
  });

  it('setRoute replaces an option route', () => {
    const base = mkPlay([
      slot('w', 'WR', { x: 8, y: 0 }, [
        { type: 'option', stem: [], vsMan: [], vsZone: [], decideAtStemEnd: true },
      ]),
    ]);
    const r = route([{ x: 8, y: 7 }]);
    expect(slotOf(run(base, setRoute('w', r)), 'w').actions).toEqual([r]);
  });

  it('moveRoutePoint moves one point, keeps smooth, clears templateId', () => {
    const p = run(withRoute(), moveRoutePoint('w', 1, { x: 13, y: 6 }));
    const r = getRoute(p, 'w')!;
    expect(r.path).toEqual([
      { x: 8, y: 5 },
      { x: 13, y: 6 },
      { x: 12, y: 10 },
    ]);
    expect(r.smooth).toEqual([false, true, false]);
    expect(r.templateId).toBeUndefined();
    expect('templateId' in r).toBe(false);
  });

  it('moveRoutePoint is a no-op for a bad index or an identical position', () => {
    const p = withRoute();
    expect(moveRoutePoint('w', 9, { x: 0, y: 0 })(p)).toBe(p);
    expect(moveRoutePoint('w', 0, { x: 8, y: 5 })(p)).toBe(p);
    expect(moveRoutePoint('nope', 0, { x: 0, y: 0 })(p)).toBe(p);
  });

  it('insertRoutePoint inserts at the index and keeps smooth aligned (new = false)', () => {
    const p = run(withRoute(), insertRoutePoint('w', 1, { x: 10, y: 5 }));
    const r = getRoute(p, 'w')!;
    expect(r.path.map((q) => q.x)).toEqual([8, 10, 12, 12]);
    expect(r.smooth).toEqual([false, false, true, false]);
    expect(r.smooth).toHaveLength(r.path.length);
    expect(r.templateId).toBeUndefined();
  });

  it('insertRoutePoint at 0 goes right after the start, and clamps past the end', () => {
    const first = getRoute(run(withRoute(), insertRoutePoint('w', 0, { x: 8, y: 2 })), 'w')!;
    expect(first.path[0]).toEqual({ x: 8, y: 2 });
    expect(first.smooth).toEqual([false, false, true, false]);
    const last = getRoute(run(withRoute(), insertRoutePoint('w', 99, { x: 12, y: 14 })), 'w')!;
    expect(last.path[3]).toEqual({ x: 12, y: 14 });
    expect(last.smooth).toEqual([false, true, false, false]);
  });

  it('insertRoutePoint leaves an absent smooth[] absent', () => {
    const base = mkPlay([slot('w', 'WR', { x: 8, y: 0 }, [route([{ x: 8, y: 5 }])])]);
    const r = getRoute(run(base, insertRoutePoint('w', 1, { x: 8, y: 9 })), 'w')!;
    expect(r.smooth).toBeUndefined();
    expect(r.path).toHaveLength(2);
  });

  it('deleteRoutePoint removes the point and its smooth flag', () => {
    const p = run(withRoute(), deleteRoutePoint('w', 1));
    const r = getRoute(p, 'w')!;
    expect(r.path).toEqual([
      { x: 8, y: 5 },
      { x: 12, y: 10 },
    ]);
    expect(r.smooth).toEqual([false, false]);
    expect(r.templateId).toBeUndefined();
  });

  it('deleting the last remaining point removes the route action', () => {
    const base = mkPlay([
      slot('w', 'WR', { x: 8, y: 0 }, [
        route([{ x: 8, y: 5 }]),
        { type: 'motion', path: [{ x: 6, y: 0 }], duration: 1 },
      ]),
    ]);
    const p = run(base, deleteRoutePoint('w', 0));
    expect(slotOf(p, 'w').actions).toEqual([{ type: 'motion', path: [{ x: 6, y: 0 }], duration: 1 }]);
    expect(getRoute(p, 'w')).toBeUndefined();
  });

  it('deleteRoutePoint is a no-op for a bad index', () => {
    const p = withRoute();
    expect(deleteRoutePoint('w', 5)(p)).toBe(p);
  });

  it('toggleRoutePointSmooth flips one flag and clears templateId', () => {
    const p = run(withRoute(), toggleRoutePointSmooth('w', 0));
    const r = getRoute(p, 'w')!;
    expect(r.smooth).toEqual([true, true, false]);
    expect(r.templateId).toBeUndefined();
    const back = getRoute(run(p, toggleRoutePointSmooth('w', 0)), 'w')!;
    expect(back.smooth).toEqual([false, true, false]);
  });

  it('toggleRoutePointSmooth builds smooth[] when absent', () => {
    const base = mkPlay([
      slot('w', 'WR', { x: 8, y: 0 }, [
        route([
          { x: 8, y: 5 },
          { x: 12, y: 5 },
        ]),
      ]),
    ]);
    expect(getRoute(run(base, toggleRoutePointSmooth('w', 1)), 'w')!.smooth).toEqual([false, true]);
  });

  it('setRouteEndBehavior changes the end behavior but keeps templateId', () => {
    const p = run(withRoute(), setRouteEndBehavior('w', 'stop'));
    const r = getRoute(p, 'w')!;
    expect(r.endBehavior).toBe('stop');
    expect(r.templateId).toBe('out');
    const q = withRoute();
    expect(setRouteEndBehavior('w', 'continue')(q)).toBe(q);
  });
});

describe('applyRouteTemplate (FR-OFF-03)', () => {
  it('a left receiver runs a slant inside (x increases)', () => {
    const p = run(offense(), applyRouteTemplate('x', 'slant'));
    const r = getRoute(p, 'x')!;
    expect(r.templateId).toBe('slant');
    expect(r.path[0]).toEqual({ x: -8, y: 3 });
    expect(r.path[1]!.x).toBeGreaterThan(r.path[0]!.x);
    expect(r.path[1]).toEqual({ x: -2, y: 9 });
  });

  it('a right receiver runs the slant inside (x decreases)', () => {
    const r = getRoute(run(offense(), applyRouteTemplate('z', 'slant')), 'z')!;
    expect(r.path[1]!.x).toBeLessThan(r.path[0]!.x);
  });

  it('an out goes toward the sideline on both sides', () => {
    const left = getRoute(run(offense(), applyRouteTemplate('x', 'out')), 'x')!;
    expect(left.path[1]!.x).toBeLessThan(-8);
    const right = getRoute(run(offense(), applyRouteTemplate('z', 'out')), 'z')!;
    expect(right.path[1]!.x).toBeGreaterThan(8);
  });

  it('honours depth and replaces an existing route', () => {
    const p = run(offense(), applyRouteTemplate('x', 'hitch', 7));
    expect(slotOf(p, 'x').actions).toHaveLength(1);
    expect(getRoute(p, 'x')!.path[0]!.y).toBe(8); // hitch goes d + 1
  });

  it('a receiver on the ball faces the strong side of the play', () => {
    const centre = (strength: Play['strength']) => mkPlay([slot('t', 'TE', { x: 0, y: 0 })], { strength });
    const right = getRoute(run(centre('right'), applyRouteTemplate('t', 'out')), 't')!;
    expect(right.path[1]!.x).toBeGreaterThan(0);
    const left = getRoute(run(centre('left'), applyRouteTemplate('t', 'out')), 't')!;
    expect(left.path[1]!.x).toBeLessThan(0);
  });

  it('is a no-op for an unknown slot', () => {
    const p = offense();
    expect(applyRouteTemplate('nope', 'go')(p)).toBe(p);
  });
});

describe('setQbDrop (FR-OFF-04)', () => {
  it('replaces the existing drop', () => {
    const p = run(offense(), setQbDrop('q', 5, 'under'));
    expect(slotOf(p, 'q').actions).toEqual([{ type: 'qbDrop', depth: 5, style: 'under' }]);
  });

  it('adds a drop when none exists', () => {
    const base = mkPlay([slot('q', 'QB', { x: 0, y: -5 })]);
    const p = run(base, setQbDrop('q', 3, 'shotgun'));
    expect(slotOf(p, 'q').actions).toEqual([{ type: 'qbDrop', depth: 3, style: 'shotgun' }]);
  });

  it('is a no-op when unchanged', () => {
    const p = offense();
    expect(setQbDrop('q', 2, 'shotgun')(p)).toBe(p);
  });
});

describe('progression (FR-OFF-04)', () => {
  it('appends in click order and removes on second click', () => {
    let p = offense();
    p = run(p, toggleProgression('z'));
    p = run(p, toggleProgression('x'));
    p = run(p, toggleProgression('y'));
    expect(p.progression).toEqual(['z', 'x', 'y']);
    p = run(p, toggleProgression('x'));
    expect(p.progression).toEqual(['z', 'y']);
  });

  it('ignores the QB and unknown ids', () => {
    const p = offense();
    expect(toggleProgression('q')(p)).toBe(p);
    expect(toggleProgression('nope')(p)).toBe(p);
  });

  it('clearProgression empties the list', () => {
    const base = { ...offense(), progression: ['x', 'z'] };
    expect(run(base, clearProgression()).progression).toEqual([]);
    const p = offense();
    expect(clearProgression()(p)).toBe(p);
  });
});

describe('strength (FR-OFF-05)', () => {
  it("setStrength('left') overrides and sets the flag", () => {
    const p = run(offense(), setStrength('left'));
    expect(p.strength).toBe('left');
    expect(p.strengthOverridden).toBe(true);
  });

  it("setStrength('auto') recomputes and clears the flag", () => {
    const base = { ...offense(), strength: 'left' as const, strengthOverridden: true };
    const p = run(base, setStrength('auto'));
    expect(p.strength).toBe('right');
    expect(p.strengthOverridden).toBe(false);
  });

  it('refreshStrength recomputes unless overridden', () => {
    const stale = { ...offense(), strength: 'left' as const };
    expect(run(stale, refreshStrength()).strength).toBe('right');
    const overridden = { ...stale, strengthOverridden: true };
    expect(refreshStrength()(overridden)).toBe(overridden);
  });

  it('on defense setStrength just sets the value, no flag', () => {
    const p = run(defense(), setStrength('left'));
    expect(p.strength).toBe('left');
    expect(p.strengthOverridden).toBeUndefined();
    const q = defense();
    expect(setStrength('auto')(q)).toBe(q);
  });

  it('unchanged strength is the same object', () => {
    const p = { ...offense(), strengthOverridden: true };
    expect(setStrength('right')(p)).toBe(p);
    const auto = { ...offense(), strengthOverridden: false };
    expect(setStrength('auto')(auto)).toBe(auto);
  });
});

describe('setMeta', () => {
  it('patches name, formation, tags and notes', () => {
    const p = run(offense(), setMeta({ name: 'Mesh', formation: 'Trips', tags: ['x', 'y'], notes: 'hi' }));
    expect(p).toMatchObject({ name: 'Mesh', formation: 'Trips', tags: ['x', 'y'], notes: 'hi' });
    expect(p.updatedAt).toBe(2);
  });

  it('is a no-op when nothing changes', () => {
    const p = offense();
    expect(setMeta({})(p)).toBe(p);
    expect(setMeta({ name: 'Test', tags: ['a'] })(p)).toBe(p);
  });
});

describe('flip (FR-FLP-02)', () => {
  it('equals flipPlay and flipping twice restores the play', () => {
    const p = offense();
    const f = run(p, flip());
    expect(f).toEqual(flipPlay(p));
    expect(slotOf(f, 'x').start.x).toBe(8);
    expect(run(f, flip())).toEqual(p);
  });
});

describe('input is never mutated', () => {
  it('every op works on a deep-frozen play', () => {
    const base = { ...offense(), progression: ['x'] };
    const ops: Recipe[] = [
      addPlayer('WR', { x: 1, y: 0 }, 6, idGen),
      movePlayer('x', { x: -5, y: 2 }),
      removePlayers(['x']),
      duplicatePlayer('x', 6, idGen),
      setLabel('x', 'W'),
      setRoute('x', null),
      moveRoutePoint('x', 0, { x: 1, y: 1 }),
      insertRoutePoint('x', 0, { x: 1, y: 1 }),
      deleteRoutePoint('x', 0),
      toggleRoutePointSmooth('x', 0),
      setRouteEndBehavior('x', 'stop'),
      applyRouteTemplate('x', 'post'),
      setQbDrop('q', 6, 'under'),
      toggleProgression('z'),
      clearProgression(),
      setStrength('left'),
      setStrength('auto'),
      refreshStrength(),
      setMeta({ name: 'n', tags: ['t'] }),
      flip(),
    ];
    for (const op of ops) expect(() => run(base, op)).not.toThrow();
  });
});
