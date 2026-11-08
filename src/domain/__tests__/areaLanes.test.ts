import { describe, expect, it } from 'vitest';
import { computeLanes, laneOf, laneSpan } from '../areaLanes';
import type { PlayerSlot } from '../types';

function def(label: string, x: number): PlayerSlot {
  return { id: label, role: 'CB', label, start: { x, y: 3.5 }, actions: [] };
}

const bangkok = (): PlayerSlot[] => [
  def('CB1', 9),
  def('LB', -1.5),
  def('CB2', -8),
  def('S', 4),
  def('R', 0),
];
const members = new Set(['CB1', 'LB', 'CB2', 'S']);
const lanesOf = () => computeLanes(bangkok(), (s) => members.has(s.id))!;

describe('lanes (D-40, D-48)', () => {
  it('boundaries are neighbour midpoints, ordered left to right; non-members are skipped', () => {
    const lanes = lanesOf();
    expect(lanes.order).toEqual(['CB2', 'LB', 'S', 'CB1']);
    expect(lanes.boundaries).toEqual([-4.75, 1.25, 6.5]);
    expect(computeLanes(bangkok(), () => false)).toBeNull();
  });

  it('laneOf maps x to the lane index', () => {
    const lanes = lanesOf();
    expect(laneOf(lanes, -10)).toBe(0);
    expect(laneOf(lanes, 0)).toBe(1);
    expect(laneOf(lanes, 5)).toBe(2);
    expect(laneOf(lanes, 7)).toBe(3);
  });

  it('laneSpan uses the sidelines for the outer lanes', () => {
    const lanes = lanesOf();
    expect(laneSpan(lanes, 0, -12.5, 12.5)).toEqual([-12.5, -4.75]);
    expect(laneSpan(lanes, 2, -12.5, 12.5)).toEqual([1.25, 6.5]);
    expect(laneSpan(lanes, 3, -12.5, 12.5)).toEqual([6.5, 12.5]);
  });
});
