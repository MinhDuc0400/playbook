import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Play } from '@/domain/types';
import { removePlayers, setReadMinScore, setReadMode, setReadWindow } from '../ops';

function base(): Play {
  const slot = (id: string, x: number) => ({
    id,
    role: 'WR' as const,
    label: id,
    start: { x, y: 0 },
    actions: [],
  });
  return {
    id: 'p',
    schemaVersion: SCHEMA_VERSION,
    name: 'T',
    side: 'offense',
    format: '5v5',
    formation: 'T',
    strength: 'right',
    strengthOverridden: false,
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    players: [slot('x', -8), slot('y', 4), slot('z', 8)],
    progression: ['x', 'y'],
  };
}

describe('read plan recipes (D-22)', () => {
  it('setReadMode sets, is same-object on no-op, and removes a default plan', () => {
    const p = base();
    expect(setReadMode('progression')(p)).toBe(p);
    const l = setReadMode('leftToRight')(p);
    expect(l.readPlan).toEqual({ mode: 'leftToRight' });
    expect(p.readPlan).toBeUndefined();
    expect(setReadMode('leftToRight')(l)).toBe(l);
    const back = setReadMode('progression')(l);
    expect('readPlan' in back).toBe(false);
  });

  it('progression keeps readPlan when windows / minScore exist', () => {
    const w = setReadWindow('x', { from: 1, to: 1.5 })(base());
    expect(w.readPlan).toEqual({ mode: 'progression', windows: { x: { from: 1, to: 1.5 } } });
    const l = setReadMode('best')(w);
    expect(setReadMode('progression')(l).readPlan?.windows?.x).toEqual({ from: 1, to: 1.5 });
  });

  it('setReadWindow validates, no-ops, and null clears down to no readPlan', () => {
    const p = base();
    expect(setReadWindow('x', { from: 1, to: 1 })(p)).toBe(p);
    expect(setReadWindow('x', { from: -1, to: 1 })(p)).toBe(p);
    expect(setReadWindow('x', { from: 1, to: 9.5 })(p)).toBe(p);
    expect(setReadWindow('x', null)(p)).toBe(p);
    const w = setReadWindow('x', { from: 0, to: 9 })(p);
    expect(w.readPlan?.windows?.x).toEqual({ from: 0, to: 9 });
    expect(setReadWindow('x', { from: 0, to: 9 })(w)).toBe(w);
    const w2 = setReadWindow('y', { from: 1, to: 2 })(w);
    expect(Object.keys(w2.readPlan?.windows ?? {})).toEqual(['x', 'y']);
    const cleared = setReadWindow('x', null)(setReadWindow('y', null)(w2));
    expect('readPlan' in cleared).toBe(false);
  });

  it('setReadMinScore validates range and null clears', () => {
    const p = base();
    expect(setReadMinScore('x', 101)(p)).toBe(p);
    expect(setReadMinScore('x', -1)(p)).toBe(p);
    expect(setReadMinScore('x', null)(p)).toBe(p);
    const m = setReadMinScore('x', 70)(p);
    expect(m.readPlan).toEqual({ mode: 'progression', minScore: { x: 70 } });
    expect(setReadMinScore('x', 70)(m)).toBe(m);
    expect('readPlan' in setReadMinScore('x', null)(m)).toBe(false);
  });

  it('is immutable', () => {
    const p = base();
    const w = setReadWindow('x', { from: 1, to: 2 })(p);
    const m = setReadMinScore('x', 60)(w);
    expect(w.readPlan?.minScore).toBeUndefined();
    expect(m.readPlan?.windows?.x).toEqual({ from: 1, to: 2 });
    expect(p.readPlan).toBeUndefined();
  });

  it('removePlayers drops the slot entries and cleans up an empty plan', () => {
    const p = setReadMinScore('y', 60)(setReadWindow('x', { from: 1, to: 2 })(base()));
    const r = removePlayers(['x'])(p);
    expect(r.readPlan).toEqual({ mode: 'progression', minScore: { y: 60 } });
    const r2 = removePlayers(['y'])(r);
    expect('readPlan' in r2).toBe(false);
    const side = removePlayers(['x'])(setReadMode('leftToRight')(base()));
    expect(side.readPlan).toEqual({ mode: 'leftToRight' });
  });
});
