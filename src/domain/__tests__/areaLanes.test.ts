import { describe, expect, it } from 'vitest';
import { computeAreaLanes, laneOf, laneSpan } from '../areaLanes';
import type { AreaMatch, PlayerSlot } from '../types';

function def(label: string, x: number, areaMatch?: AreaMatch): PlayerSlot {
  const s: PlayerSlot = { id: label, role: 'CB', label, start: { x, y: 3.5 }, actions: [] };
  if (areaMatch) s.areaMatch = areaMatch;
  return s;
}

const bangkok = (): PlayerSlot[] => [
  def('CB1', 9, { role: 'corner' }),
  def('LB', -1.5, { role: 'inside' }),
  def('CB2', -8, { role: 'corner' }),
  def('S', 4, { role: 'inside' }),
];

describe('T-AM lanes (D-40)', () => {
  it('boundaries are neighbour midpoints, ordered left to right', () => {
    const lanes = computeAreaLanes(bangkok())!;
    expect(lanes.order).toEqual(['CB2', 'LB', 'S', 'CB1']);
    expect(lanes.boundaries).toEqual([-4.75, 1.25, 6.5]);
    expect(lanes.roles).toEqual(['corner', 'inside', 'inside', 'corner']);
    expect(lanes.outside).toEqual([null, 0, 3, null]);
  });

  it('laneOf maps x to the lane index', () => {
    const lanes = computeAreaLanes(bangkok())!;
    expect(laneOf(lanes, -10)).toBe(0);
    expect(laneOf(lanes, 0)).toBe(1);
    expect(laneOf(lanes, 5)).toBe(2);
    expect(laneOf(lanes, 7)).toBe(3);
  });

  it('laneSpan uses the sidelines for the outer lanes', () => {
    const lanes = computeAreaLanes(bangkok())!;
    expect(laneSpan(lanes, 0, -12.5, 12.5)).toEqual([-12.5, -4.75]);
    expect(laneSpan(lanes, 2, -12.5, 12.5)).toEqual([1.25, 6.5]);
    expect(laneSpan(lanes, 3, -12.5, 12.5)).toEqual([6.5, 12.5]);
  });

  it('slots without areaMatch are skipped; zero area slots gives null', () => {
    const lanes = computeAreaLanes([...bangkok(), def('R', 0)])!;
    expect(lanes.order).toHaveLength(4);
    expect(computeAreaLanes([def('R', 0), def('X', 3)])).toBeNull();
  });

  it('inside with no corner neighbour has outside null', () => {
    const lanes = computeAreaLanes([def('A', -2, { role: 'inside' }), def('B', 2, { role: 'inside' })])!;
    expect(lanes.outside).toEqual([null, null]);
  });
});
