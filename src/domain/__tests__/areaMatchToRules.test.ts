import { describe, expect, it } from 'vitest';
import { areaMatchToRules, CONVERTED_NOTE } from '../areaMatchToRules';
import { matchTemplate, zoneShapeOf } from '../areaRules';
import { createDefaultFields } from '../field';
import { SCHEMA_VERSION, type Play, type PlayerSlot } from '../types';

const field = createDefaultFields()['5v5'];

const zone = (x: number) => ({
  type: 'zone' as const,
  zone: {
    polygon: [
      { x: x - 2, y: 0 },
      { x: x + 2, y: 0 },
      { x, y: 6 },
    ],
  },
  dropPoint: { x, y: 3 },
});

function oldBangkok(): Play {
  const area = (id: string, x: number, role: 'corner' | 'inside', actions: PlayerSlot['actions'] = []) =>
    ({ id, role: 'CB', label: id, start: { x, y: 3.5 }, actions, areaMatch: { role } }) as PlayerSlot;
  return {
    id: 'bk',
    schemaVersion: SCHEMA_VERSION,
    name: 'Bangkok',
    side: 'defense',
    format: '5v5',
    formation: 'Bunch Killer',
    strength: 'right',
    players: [
      area('CB2', -8, 'corner'),
      area('LB', -1.5, 'inside', [zone(-1.5)]),
      area('S', 4, 'inside', [zone(4)]),
      area('CB1', 9, 'corner'),
      {
        id: 'R',
        role: 'R',
        label: 'R',
        start: { x: -7, y: 7 },
        actions: [{ type: 'rush', path: [{ x: 0, y: -5 }] }],
      },
    ],
    tags: [],
    notes: 'Old notes',
    createdAt: 1,
    updatedAt: 1,
  };
}

const slotOf = (p: Play, id: string) => p.players.find((s) => s.id === id)!;
const teammate = (s: PlayerSlot) => {
  const a = s.matchRules?.[0]?.when.area;
  return a?.kind === 'teammate' ? a.slotId : undefined;
};

describe('D-48 areaMatchToRules', () => {
  it('Bangkok: corners get the corner rule, insides the inside rule on their outside corner', () => {
    const p = areaMatchToRules(oldBangkok());
    expect(matchTemplate(slotOf(p, 'CB1').matchRules)).toBe('corner');
    expect(matchTemplate(slotOf(p, 'CB2').matchRules)).toBe('corner');
    expect(matchTemplate(slotOf(p, 'S').matchRules)).toBe('inside');
    expect(matchTemplate(slotOf(p, 'LB').matchRules)).toBe('inside');
    expect(teammate(slotOf(p, 'S'))).toBe('CB1');
    expect(teammate(slotOf(p, 'LB'))).toBe('CB2');
    expect(slotOf(p, 'CB1').matchRules![0]!.id).toBe('CB1-bk');
    for (const s of p.players) expect('areaMatch' in s).toBe(false);
    expect(p.notes).toBe(`Old notes\n${CONVERTED_NOTE}`);
    expect(slotOf(p, 'R')).toEqual(slotOf(oldBangkok(), 'R'));
    expect(slotOf(p, 'S').actions).toEqual([zone(4)]);
  });

  it('an inside slot with no zone gets the live lane zone (D-51)', () => {
    const old = oldBangkok();
    old.players = old.players.map((s) => (s.id === 'S' ? { ...s, actions: [] } : s));
    const p = areaMatchToRules(old);
    const z = slotOf(p, 'S').actions[0];
    expect(z).toEqual({ type: 'zone', zone: 'lane', dropPoint: slotOf(p, 'S').start });
    if (z?.type !== 'zone') throw new Error('expected a zone');
    const xs = zoneShapeOf(z, slotOf(p, 'S').id, p.players, field).polygon.map((q) => q.x);
    expect(Math.min(...xs)).toBeCloseTo(1.25);
    expect(Math.max(...xs)).toBeCloseTo(6.5);
  });

  it('a corner loses its zone action; old custom rules on an area slot are dropped', () => {
    const old = oldBangkok();
    old.players = old.players.map((s) =>
      s.id === 'CB1'
        ? {
            ...s,
            actions: [zone(9)],
            matchRules: [
              {
                id: 'm',
                priority: 0,
                when: { receiver: { kind: 'number', side: 'strong', number: 1 }, event: 'vertical' },
                then: { type: 'carry' },
              },
            ],
          }
        : s,
    );
    const cb1 = slotOf(areaMatchToRules(old), 'CB1');
    expect(cb1.actions).toEqual([]);
    expect(matchTemplate(cb1.matchRules)).toBe('corner');
  });

  it('areaMatch on a rusher is just removed; a play without areaMatch is returned as is', () => {
    const old = oldBangkok();
    old.players = old.players.map((s) =>
      s.id === 'R' ? ({ ...s, areaMatch: { role: 'corner' } } as PlayerSlot) : s,
    );
    const p = areaMatchToRules(old);
    expect('areaMatch' in slotOf(p, 'R')).toBe(false);
    expect(slotOf(p, 'R').matchRules).toBeUndefined();
    const plain = { ...oldBangkok(), players: [] };
    expect(areaMatchToRules(plain)).toBe(plain);
  });
});
