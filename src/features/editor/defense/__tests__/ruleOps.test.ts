import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type MatchRule, type Play } from '@/domain/types';
import { addRule, moveRule, removeRule, updateRule } from '../ruleOps';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

const rule = (id: string, priority: number): MatchRule => ({
  id,
  priority,
  when: { receiver: { kind: 'role', role: 'RB' }, event: 'out' },
  then: { type: 'carry' },
});

function mk(rules?: MatchRule[]): Play {
  return deepFreeze({
    id: 'd',
    schemaVersion: SCHEMA_VERSION,
    name: 'D',
    side: 'defense',
    format: '5v5',
    formation: 'T',
    strength: 'right',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players: [
      {
        id: 'cb',
        role: 'CB',
        label: 'CB',
        start: { x: 0, y: 5 },
        actions: [],
        ...(rules ? { matchRules: rules } : {}),
      },
      { id: 'lb', role: 'LB', label: 'LB', start: { x: 3, y: 4 }, actions: [] },
    ],
  });
}

const rulesOf = (p: Play, id = 'cb'): MatchRule[] => p.players.find((s) => s.id === id)?.matchRules ?? [];

describe('ruleOps (FR-DEF-07)', () => {
  it('addRule appends the default rule with priority max + 1', () => {
    const a = addRule('cb', () => 'n1')(mk());
    expect(rulesOf(a)).toEqual([
      {
        id: 'n1',
        priority: 0,
        when: { receiver: { kind: 'number', side: 'strong', number: 1 }, event: 'vertical', minDepth: 8 },
        then: { type: 'carry' },
      },
    ]);
    const b = addRule('cb', () => 'n2')(mk([rule('a', 0), rule('b', 1)]));
    expect(rulesOf(b).map((r) => [r.id, r.priority])).toEqual([
      ['a', 0],
      ['b', 1],
      ['n2', 2],
    ]);
  });

  it('unknown slot is a no-op (same object)', () => {
    const p = mk();
    expect(addRule('zz', () => 'x')(p)).toBe(p);
    expect(removeRule('zz', 'a')(p)).toBe(p);
  });

  it('updateRule patches when/then, removes undefined keys, same object when unchanged', () => {
    const p = mk([{ ...rule('a', 0), when: { ...rule('a', 0).when, minDepth: 5 } }]);
    const q = updateRule('cb', 'a', { when: { minDepth: undefined, event: 'in' } })(p);
    expect(rulesOf(q)[0]?.when).toEqual({ receiver: { kind: 'role', role: 'RB' }, event: 'in' });
    const z = updateRule('cb', 'a', { then: { type: 'zone', zone: 'flat-L' } })(p);
    expect(rulesOf(z)[0]?.then).toEqual({ type: 'zone', zone: 'flat-L' });
    expect(updateRule('cb', 'a', { when: { minDepth: 5 } })(p)).toBe(p);
    expect(updateRule('cb', 'missing', { when: { event: 'in' } })(p)).toBe(p);
  });

  it('removeRule re-packs priorities', () => {
    const p = mk([rule('a', 0), rule('b', 1), rule('c', 2)]);
    const q = removeRule('cb', 'a')(p);
    expect(rulesOf(q).map((r) => [r.id, r.priority])).toEqual([
      ['b', 0],
      ['c', 1],
    ]);
    expect(removeRule('cb', 'nope')(p)).toBe(p);
  });

  it('moveRule reorders, re-packs, clamps, and no-ops', () => {
    const p = mk([rule('a', 0), rule('b', 1), rule('c', 2)]);
    expect(rulesOf(moveRule('cb', 'a', 2)(p)).map((r) => [r.id, r.priority])).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
    ]);
    expect(rulesOf(moveRule('cb', 'c', -5)(p)).map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(moveRule('cb', 'b', 1)(p)).toBe(p);
    expect(moveRule('cb', 'x', 0)(p)).toBe(p);
  });

  it('sorts by priority and re-packs gaps; other slots untouched', () => {
    const p = mk([rule('a', 5), rule('b', 2)]);
    const q = moveRule('cb', 'a', 0)(p);
    expect(rulesOf(q).map((r) => [r.id, r.priority])).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
    expect(q.players[1]).toBe(p.players[1]);
  });
});
