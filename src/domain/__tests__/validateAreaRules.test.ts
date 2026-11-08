import { describe, expect, it } from 'vitest';
import { cornerRules, insideRules } from '../areaRules';
import { createDefaultFields } from '../field';
import { SCHEMA_VERSION, type Play, type PlayerSlot } from '../types';
import { validatePlay } from '../validate';

const field = createDefaultFields()['5v5'];
const slot = (id: string, x: number, extra: Partial<PlayerSlot> = {}): PlayerSlot => ({
  id,
  role: 'CB',
  label: id,
  start: { x, y: 3.5 },
  actions: [],
  ...extra,
});
const play = (players: PlayerSlot[]): Play => ({
  id: 'd',
  schemaVersion: SCHEMA_VERSION,
  name: 'D',
  side: 'defense',
  format: '5v5',
  formation: '',
  strength: 'right',
  alignTo: 'ball',
  players,
  tags: [],
  createdAt: 1,
  updatedAt: 1,
});
const codes = (p: Play) => validatePlay(p, field).filter((w) => w.code.startsWith('area-rule'));

describe('D-48 area rule warnings (Review Focus 1)', () => {
  it('the Bunch Killer rules give no warnings', () => {
    const p = play([
      slot('CB2', -8, { matchRules: cornerRules(() => 'a') }),
      slot('S', 4, { matchRules: insideRules(() => 'b', 'CB1') }),
      slot('CB1', 9, { matchRules: cornerRules(() => 'c') }),
    ]);
    expect(codes(p)).toEqual([]);
  });

  it('an area rule naming a deleted teammate → area-rule-bad-target', () => {
    const p = play([slot('S', 4, { matchRules: insideRules(() => 'b', 'GONE') }), slot('CB1', 9)]);
    expect(codes(p)).toEqual([{ code: 'area-rule-bad-target', slotId: 'S' }]);
  });

  it('naming itself, a rusher, or using nth with a direction event → area-rule-bad-target', () => {
    const r = slot('R', 0, { role: 'R', actions: [{ type: 'rush', path: [{ x: 0, y: -5 }] }] });
    expect(codes(play([r, slot('S', 4, { matchRules: insideRules(() => 'b', 'R') })]))).toEqual([
      { code: 'area-rule-bad-target', slotId: 'S' },
    ]);
    expect(codes(play([slot('S', 4, { matchRules: insideRules(() => 'b', 'S') })]))).toEqual([
      { code: 'area-rule-bad-target', slotId: 'S' },
    ]);
    const nth = slot('S', 4, {
      matchRules: [
        {
          id: 'n',
          priority: 0,
          when: { receiver: { kind: 'nth', n: 1 }, event: 'out' },
          then: { type: 'carry' },
        },
      ],
    });
    expect(codes(play([nth]))).toEqual([{ code: 'area-rule-bad-target', slotId: 'S' }]);
  });

  it('an area rule on a rusher → area-rule-ignored', () => {
    const r = slot('R', 0, {
      role: 'R',
      actions: [{ type: 'rush', path: [{ x: 0, y: -5 }] }],
      matchRules: cornerRules(() => 'r'),
    });
    expect(codes(play([r]))).toEqual([{ code: 'area-rule-ignored', slotId: 'R' }]);
  });
});
