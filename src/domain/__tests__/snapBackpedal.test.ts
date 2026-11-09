import { describe, expect, it } from 'vitest';
import {
  BACKPEDAL_YARDS,
  cornerRules,
  hasSnapBackpedal,
  insideRules,
  isSnapBackpedal,
  matchTemplate,
  snapBackpedalRule,
  withSnapBackpedal,
} from '../areaRules';
import type { MatchRule } from '../types';

let n = 0;
const idGen = () => `r${++n}`;

describe('D-52 backpedal at the snap', () => {
  it('the rule: Khi bóng snap thì lùi 3 yd', () => {
    const rule = snapBackpedalRule(() => 'bp');
    expect(BACKPEDAL_YARDS).toBe(3);
    expect(rule).toEqual({
      id: 'bp',
      priority: 0,
      when: { receiver: { kind: 'any' }, event: 'snap' },
      then: { type: 'backpedal', yards: 3 },
    });
    expect(isSnapBackpedal(rule)).toBe(true);
    expect(isSnapBackpedal(cornerRules(idGen)[0]!)).toBe(false);
  });

  it('turning it on puts it first and keeps the other rules in order', () => {
    const corner = cornerRules(idGen);
    const out = withSnapBackpedal(corner, true, () => 'bp');
    expect(out.map((r) => r.id)).toEqual(['bp', corner[0]!.id]);
    expect(out.map((r) => r.priority)).toEqual([0, 1]);
    expect(hasSnapBackpedal(out)).toBe(true);
  });

  it('turning it on twice keeps one; turning it off removes it and keeps the rest', () => {
    const on = withSnapBackpedal(cornerRules(idGen), true, () => 'bp');
    expect(withSnapBackpedal(on, true, () => 'bp2')).toBe(on);
    const off = withSnapBackpedal(on, false, idGen);
    expect(off.map((r) => r.when.event)).toEqual(['entersArea']);
    expect(hasSnapBackpedal(off)).toBe(false);
  });

  it('a template with the backpedal on top is still that template', () => {
    expect(matchTemplate(withSnapBackpedal(cornerRules(idGen), true, idGen))).toBe('corner');
    expect(matchTemplate(withSnapBackpedal(insideRules(idGen, 'CB1'), true, idGen))).toBe('inside');
    const two: MatchRule[] = [...cornerRules(idGen), ...cornerRules(idGen)];
    expect(matchTemplate(withSnapBackpedal(two, true, idGen))).toBeNull();
  });
});
