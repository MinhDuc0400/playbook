import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '@/domain/field';
import { SCHEMA_VERSION, type Play, type PlayerSlot, type Point } from '@/domain/types';
import { zonePreset } from '@/domain/zones';
import {
  DEFAULT_QB_SPOT,
  clearAssignment,
  setAlignTo,
  setDesignStrength,
  setDropPoint,
  setLeverage,
  setMan,
  setManTechnique,
  setRush,
  setRushPath,
  setZone,
} from '../ops';

const FIELD = createDefaultFields()['5v5'];

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
  extra: Partial<PlayerSlot> = {},
): PlayerSlot {
  return { id, role, label: id, start, actions, ...extra };
}

function defense(): Play {
  return deepFreeze({
    id: 'd1',
    schemaVersion: SCHEMA_VERSION,
    name: 'D',
    side: 'defense',
    format: '5v5',
    formation: 'Cover 3',
    strength: 'right',
    alignTo: 'ball',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players: [
      slot('cb', 'CB', { x: 11, y: 5 }),
      slot('fs', 'S', { x: 0, y: 11 }, [{ type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 14 } }]),
      slot('lb', 'LB', { x: 3, y: 5 }, [], { leverage: 'inside' }),
      slot('r1', 'R', { x: 0, y: 7 }, [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]),
      slot('r2', 'R', { x: 4, y: 7 }, [{ type: 'rush', path: [{ x: 1, y: -3 }], delay: 0 }], {
        leverage: 'outside',
      }),
    ],
  });
}

const get = (p: Play, id: string): PlayerSlot => {
  const s = p.players.find((x) => x.id === id);
  if (!s) throw new Error(`no slot ${id}`);
  return s;
};

describe('setMan (FR-DEF-02)', () => {
  it('stores the ref, technique defaults to trail, no cushion key', () => {
    const next = setMan('cb', { kind: 'number', side: 'strong', number: 1 })(defense());
    expect(get(next, 'cb').actions).toEqual([
      { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' },
    ]);
  });

  it('cushion technique defaults cushion to 5, explicit cushion wins', () => {
    const t = { kind: 'role', role: 'RB' } as const;
    expect(get(setMan('cb', t, 'cushion')(defense()), 'cb').actions).toEqual([
      { type: 'man', target: t, technique: 'cushion', cushion: 5 },
    ]);
    expect(get(setMan('cb', t, 'cushion', 7)(defense()), 'cb').actions).toEqual([
      { type: 'man', target: t, technique: 'cushion', cushion: 7 },
    ]);
  });

  it('replaces an existing zone, keeping other action types', () => {
    const p = defense();
    const withExtra: Play = {
      ...p,
      players: p.players.map((s) =>
        s.id === 'fs' ? { ...s, actions: [...s.actions, { type: 'qbDrop', depth: 1, style: 'under' }] } : s,
      ),
    };
    const next = setMan('fs', { kind: 'number', side: 'weak', number: 1 })(withExtra);
    const actions = get(next, 'fs').actions;
    expect(actions.map((a) => a.type).sort()).toEqual(['man', 'qbDrop']);
  });

  it('turns an R into an LB and drops the rush', () => {
    const next = setMan('r1', { kind: 'role', role: 'QB' })(defense());
    expect(get(next, 'r1').role).toBe('LB');
    expect(get(next, 'r1').actions.map((a) => a.type)).toEqual(['man']);
  });

  it('does not touch updatedAt or other slots', () => {
    const p = defense();
    const next = setMan('cb', { kind: 'role', role: 'C' })(p);
    expect(next.updatedAt).toBe(p.updatedAt);
    expect(get(next, 'fs')).toBe(get(p, 'fs'));
  });

  it('returns the same play for identical result and unknown slot', () => {
    const t = { kind: 'number', side: 'strong', number: 2 } as const;
    const once = setMan('cb', t, 'cushion', 6)(defense());
    expect(setMan('cb', t, 'cushion', 6)(once)).toBe(once);
    const p = defense();
    expect(setMan('nope', t)(p)).toBe(p);
  });

  it('copies the target ref', () => {
    const t = { kind: 'number', side: 'strong', number: 1 } as const;
    const next = setMan('cb', t)(defense());
    const a = get(next, 'cb').actions[0];
    expect(a?.type === 'man' && a.target).not.toBe(t);
  });
});

describe('setManTechnique', () => {
  const t = { kind: 'number', side: 'strong', number: 1 } as const;
  const withMan = (): Play => setMan('cb', t)(defense());

  it('switches trail → cushion with default and explicit cushion', () => {
    expect(get(setManTechnique('cb', 'cushion')(withMan()), 'cb').actions).toEqual([
      { type: 'man', target: t, technique: 'cushion', cushion: 5 },
    ]);
    expect(get(setManTechnique('cb', 'cushion', 3)(withMan()), 'cb').actions).toEqual([
      { type: 'man', target: t, technique: 'cushion', cushion: 3 },
    ]);
  });

  it('keeps the current cushion when none is given; trail drops the cushion', () => {
    const cushioned = setMan('cb', t, 'cushion', 8)(defense());
    expect(get(setManTechnique('cb', 'cushion')(cushioned), 'cb')).toBe(get(cushioned, 'cb'));
    expect(get(setManTechnique('cb', 'trail')(cushioned), 'cb').actions).toEqual([
      { type: 'man', target: t, technique: 'trail' },
    ]);
  });

  it('is a no-op without a man action and when unchanged', () => {
    const p = defense();
    expect(setManTechnique('fs', 'cushion')(p)).toBe(p);
    expect(setManTechnique('nope', 'cushion')(p)).toBe(p);
    const m = withMan();
    expect(setManTechnique('cb', 'trail')(m)).toBe(m);
  });
});

describe('setZone (FR-DEF-03)', () => {
  it('preset: default drop point from zonePreset', () => {
    const next = setZone('cb', 'flat-R', FIELD)(defense());
    expect(get(next, 'cb').actions).toEqual([
      { type: 'zone', zone: 'flat-R', dropPoint: zonePreset('flat-R', FIELD).dropPoint },
    ]);
  });

  it('preset on a 7v7 field scales the drop point', () => {
    const f7 = createDefaultFields()['7v7'];
    const a = get(setZone('cb', 'flat-R', f7)(defense()), 'cb').actions[0];
    expect(a?.type === 'zone' && a.dropPoint).toEqual(zonePreset('flat-R', f7).dropPoint);
  });

  it('polygon: drop point defaults to the centroid, polygon is copied', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 6 },
      { x: 0, y: 6 },
    ];
    const next = setZone('cb', { polygon }, FIELD)(defense());
    const a = get(next, 'cb').actions[0];
    expect(a).toEqual({ type: 'zone', zone: { polygon }, dropPoint: { x: 2, y: 3 } });
    expect(a?.type === 'zone' && typeof a.zone !== 'string' && a.zone.polygon).not.toBe(polygon);
  });

  it('explicit drop point wins', () => {
    const next = setZone('cb', 'hook-L', FIELD, { x: -5, y: 8 })(defense());
    expect(get(next, 'cb').actions).toEqual([{ type: 'zone', zone: 'hook-L', dropPoint: { x: -5, y: 8 } }]);
  });

  it('replaces man/rush, R → LB, same object when identical', () => {
    const next = setZone('r1', 'hook-M', FIELD)(defense());
    expect(get(next, 'r1').role).toBe('LB');
    expect(get(next, 'r1').actions.map((a) => a.type)).toEqual(['zone']);
    expect(setZone('r1', 'hook-M', FIELD)(next)).toBe(next);
    const p = defense();
    expect(setZone('fs', 'deep-middle', FIELD)(p)).toBe(p);
  });
});

describe('setDropPoint', () => {
  it('moves the drop point and copies it', () => {
    const p = { x: 2, y: 13 };
    const next = setDropPoint('fs', p)(defense());
    const a = get(next, 'fs').actions[0];
    expect(a).toEqual({ type: 'zone', zone: 'deep-middle', dropPoint: { x: 2, y: 13 } });
    expect(a?.type === 'zone' && a.dropPoint).not.toBe(p);
  });

  it('no-op for same point and for slots without a zone', () => {
    const d = defense();
    expect(setDropPoint('fs', { x: 0, y: 14 })(d)).toBe(d);
    expect(setDropPoint('cb', { x: 1, y: 1 })(d)).toBe(d);
  });
});

describe('setRush (FR-DEF-04)', () => {
  it('role R, leverage removed, rush to the default QB spot with delay 0', () => {
    const next = setRush('lb')(defense());
    const s = get(next, 'lb');
    expect(s.role).toBe('R');
    expect('leverage' in s).toBe(false);
    expect(s.actions).toEqual([{ type: 'rush', path: [DEFAULT_QB_SPOT], delay: 0 }]);
  });

  it('uses a given QB spot and replaces coverage', () => {
    const next = setRush('fs', { x: 1, y: -6 })(defense());
    expect(get(next, 'fs').actions).toEqual([{ type: 'rush', path: [{ x: 1, y: -6 }], delay: 0 }]);
    expect(get(next, 'fs').role).toBe('R');
  });

  it('works for a third rusher (maxRushers is only a validate warning)', () => {
    const next = setRush('cb')(defense());
    expect(next.players.filter((s) => s.role === 'R')).toHaveLength(3);
  });

  it('resets an existing rush; same object when it already matches', () => {
    const d = defense();
    expect(setRush('r1')(d)).toBe(d);
    const reset = setRush('r2')(d);
    expect(get(reset, 'r2').actions).toEqual([{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }]);
    expect('leverage' in get(reset, 'r2')).toBe(false);
  });
});

describe('setRushPath', () => {
  it('replaces the path, keeps delay, copies points', () => {
    const path = [
      { x: 2, y: 3 },
      { x: 0, y: -5 },
    ];
    const next = setRushPath('r1', path)(defense());
    const a = get(next, 'r1').actions[0];
    expect(a).toEqual({ type: 'rush', path, delay: 0 });
    expect(a?.type === 'rush' && a.path[0]).not.toBe(path[0]);
  });

  it('no-op for same path and for slots without a rush', () => {
    const d = defense();
    expect(setRushPath('r1', [{ x: 0, y: -5 }])(d)).toBe(d);
    expect(setRushPath('cb', [{ x: 0, y: 0 }])(d)).toBe(d);
  });
});

describe('clearAssignment', () => {
  it('removes coverage', () => {
    const next = clearAssignment('fs')(defense());
    expect(get(next, 'fs').actions).toEqual([]);
    expect(get(next, 'fs').role).toBe('S');
  });

  it('removes a rush and turns R into LB', () => {
    const next = clearAssignment('r1')(defense());
    expect(get(next, 'r1').actions).toEqual([]);
    expect(get(next, 'r1').role).toBe('LB');
  });

  it('no-op when nothing to clear', () => {
    const d = defense();
    expect(clearAssignment('cb')(d)).toBe(d);
    expect(clearAssignment('nope')(d)).toBe(d);
  });
});

describe('setLeverage (FR-DEF-05)', () => {
  it('sets, changes and unsets', () => {
    const set = setLeverage('cb', 'outside')(defense());
    expect(get(set, 'cb').leverage).toBe('outside');
    const changed = setLeverage('lb', 'head-up')(set);
    expect(get(changed, 'lb').leverage).toBe('head-up');
    const unset = setLeverage('lb', undefined)(changed);
    expect('leverage' in get(unset, 'lb')).toBe(false);
  });

  it('same object when unchanged', () => {
    const d = defense();
    expect(setLeverage('lb', 'inside')(d)).toBe(d);
    expect(setLeverage('cb', undefined)(d)).toBe(d);
  });
});

describe('setAlignTo / setDesignStrength (FR-DEF-06, FR-DEF-01)', () => {
  it('setAlignTo', () => {
    const d = defense();
    expect(setAlignTo('strength')(d).alignTo).toBe('strength');
    expect(setAlignTo('ball')(d)).toBe(d);
    expect(setAlignTo('strength')(d).updatedAt).toBe(d.updatedAt);
  });

  it('setDesignStrength', () => {
    const d = defense();
    expect(setDesignStrength('left')(d).strength).toBe('left');
    expect(setDesignStrength('balanced')(d).strength).toBe('balanced');
    expect(setDesignStrength('right')(d)).toBe(d);
  });
});

describe('purity', () => {
  it('no recipe mutates a frozen play', () => {
    const d = defense();
    expect(() => {
      setMan('cb', { kind: 'role', role: 'QB' }, 'cushion')(d);
      setManTechnique('cb', 'cushion')(d);
      setZone('cb', 'hook-M', FIELD)(d);
      setDropPoint('fs', { x: 1, y: 1 })(d);
      setRush('cb')(d);
      setRushPath('r1', [{ x: 1, y: 1 }])(d);
      clearAssignment('r1')(d);
      setLeverage('cb', 'inside')(d);
      setAlignTo('strength')(d);
      setDesignStrength('left')(d);
    }).not.toThrow();
  });
});
