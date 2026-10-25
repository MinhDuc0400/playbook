import { describe, expect, it } from 'vitest';
import {
  clampToField,
  createDefaultFields,
  DEFAULT_BALL_SPOT,
  fieldBounds,
  goalLineY,
  isInNoRunZone,
  isInsideField,
  sidelineBounds,
  yardLineToY,
  yToYardLine,
} from '../field';

const fields = createDefaultFields();
const f5 = fields['5v5'];

describe('sidelineBounds', () => {
  it('centered ball on 5v5', () => {
    expect(sidelineBounds(f5, { x: 0, yardLine: 15 })).toEqual({ minX: -15, maxX: 15 });
  });
  it('ball 5 yd right of center', () => {
    expect(sidelineBounds(f5, { x: 5, yardLine: 15 })).toEqual({ minX: -20, maxX: 10 });
  });
  it('7v7 is 40 yd wide', () => {
    expect(sidelineBounds(fields['7v7'], { x: 0, yardLine: 15 })).toEqual({ minX: -20, maxX: 20 });
  });
});

describe('yard lines', () => {
  const spot = { x: 0, yardLine: 15 };
  it('yardLineToY is relative to the LOS', () => {
    expect(yardLineToY(spot, 15)).toBe(0);
    expect(yardLineToY(spot, 0)).toBe(-15);
    expect(yardLineToY(spot, 50)).toBe(35);
  });
  it('round-trips', () => {
    for (const yl of [0, 7.5, 15, 25, 50]) {
      expect(yToYardLine(spot, yardLineToY(spot, yl))).toBeCloseTo(yl);
    }
    expect(yToYardLine(spot, -4)).toBe(11);
  });
  it('goalLineY with yardLine 15 is 35', () => {
    expect(goalLineY(f5, spot)).toBe(35);
  });
});

describe('fieldBounds / inside / clamp', () => {
  const spot = { x: 5, yardLine: 15 };
  it('fieldBounds includes end zones', () => {
    expect(fieldBounds(f5, spot)).toEqual({ minX: -20, maxX: 10, minY: -25, maxY: 45 });
    expect(fieldBounds(f5, DEFAULT_BALL_SPOT)).toEqual({ minX: -15, maxX: 15, minY: -25, maxY: 45 });
  });
  it('isInsideField is inclusive', () => {
    expect(isInsideField({ x: 0, y: 0 }, f5, spot)).toBe(true);
    expect(isInsideField({ x: 10, y: 45 }, f5, spot)).toBe(true);
    expect(isInsideField({ x: -20, y: -25 }, f5, spot)).toBe(true);
    expect(isInsideField({ x: 10.01, y: 0 }, f5, spot)).toBe(false);
    expect(isInsideField({ x: 0, y: 45.01 }, f5, spot)).toBe(false);
    expect(isInsideField({ x: 0, y: -25.01 }, f5, spot)).toBe(false);
    expect(isInsideField({ x: -20.5, y: 0 }, f5, spot)).toBe(false);
  });
  it('clampToField pulls points back in, leaves inside points alone', () => {
    expect(clampToField({ x: 30, y: 100 }, f5, spot)).toEqual({ x: 10, y: 45 });
    expect(clampToField({ x: -99, y: -99 }, f5, spot)).toEqual({ x: -20, y: -25 });
    expect(clampToField({ x: 2, y: 3 }, f5, spot)).toEqual({ x: 2, y: 3 });
  });
});

describe('isInNoRunZone', () => {
  it.each([20, 22, 25, 47])('true at yard line %d', (yardLine) => {
    expect(isInNoRunZone(f5, { x: 0, yardLine })).toBe(true);
  });
  it.each([15, 30])('false at yard line %d', (yardLine) => {
    expect(isInNoRunZone(f5, { x: 0, yardLine })).toBe(false);
  });
  it('zone ends are inclusive', () => {
    expect(isInNoRunZone(f5, { x: 0, yardLine: 45 })).toBe(true);
    expect(isInNoRunZone(f5, { x: 0, yardLine: 50 })).toBe(true);
    expect(isInNoRunZone(f5, { x: 0, yardLine: 19.9 })).toBe(false);
  });
});
