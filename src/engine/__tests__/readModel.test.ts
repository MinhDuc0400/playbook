import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Point } from '@/domain/types';
import {
  buildWindows,
  laneRisk,
  minScoreFor,
  predictedSeparation,
  readOrder,
  readScore,
  type ReceiverInfo,
} from '../readModel';
import type { PerceivedPlayer } from '../types';

const T = DEFAULT_TUNING;
const r = (id: string, x: number, y = -1, breakTime?: number): ReceiverInfo => ({
  id,
  pos: { x, y },
  ...(breakTime === undefined ? {} : { breakTime }),
});
// Trips right + C: X far left? No: trips right (x 14, 9, 5), single left wide, C under center.
const trips = [r('Z', -12), r('A', 14), r('B', 9), r('Y', 5), r('C', 0, -1.5)];
const twoByOne = [r('L', -10), r('M', 6), r('N', 12)];
const def = (x: number, y: number, vx = 0, vy = 0): PerceivedPlayer => ({
  id: `d${x}${y}`,
  side: 'defense',
  role: 'S',
  pos: { x, y },
  vel: { x: vx, y: vy },
});

describe('readOrder', () => {
  it('leftToRight / rightToLeft sort by x', () => {
    expect(readOrder('leftToRight', [], trips, 'right')).toEqual(['Z', 'C', 'Y', 'B', 'A']);
    expect(readOrder('rightToLeft', [], trips, 'right')).toEqual(['A', 'B', 'Y', 'C', 'Z']);
    expect(readOrder('leftToRight', [], twoByOne, 'right')).toEqual(['L', 'M', 'N']);
  });
  it('strongToWeak: strong outside-in, then C, then weak', () => {
    expect(readOrder('strongToWeak', [], trips, 'right')).toEqual(['A', 'B', 'Y', 'C', 'Z']);
    expect(readOrder('strongToWeak', [], twoByOne, 'right')).toEqual(['N', 'M', 'L']);
    expect(readOrder('strongToWeak', [], twoByOne, 'left')).toEqual(['L', 'N', 'M']);
  });
  it('weakToStrong starts on the weak side', () => {
    expect(readOrder('weakToStrong', [], trips, 'right')).toEqual(['Z', 'C', 'A', 'B', 'Y']);
  });
  it('progression filters unknown ids, appends unlisted by id; best behaves like progression', () => {
    expect(readOrder('progression', ['Y', 'ghost', 'Z'], trips, 'right')).toEqual(['Y', 'Z', 'A', 'B', 'C']);
    expect(readOrder('best', ['Y', 'ghost', 'Z'], trips, 'right')).toEqual(['Y', 'Z', 'A', 'B', 'C']);
  });
  it('empty progression falls back to left to right', () => {
    expect(readOrder('progression', [], trips, 'right')).toEqual(['Z', 'C', 'Y', 'B', 'A']);
  });
});

describe('buildWindows', () => {
  const dropEnd = 1.0;
  it('auto windows are sequential', () => {
    const recs = [r('a', 0, -1, 1.5), r('b', 3, -1, 1.6)];
    const w = buildWindows({
      order: ['a', 'b'],
      receivers: recs,
      plan: undefined,
      dropEnd,
      readSec: 0.6,
      tuning: T,
    });
    expect(w[0]).toMatchObject({ id: 'a', index: 0, auto: true });
    expect(w[0]?.from).toBeCloseTo(1.0);
    expect(w[0]?.to).toBeCloseTo(1.8); // break 1.5 > from: min(1.5 + 0.3, 1.0 + 1.2) = 1.8
    expect(w[1]?.from).toBeCloseTo(1.8);
    expect(w[1]?.to).toBeCloseTo(2.4); // break 1.6 <= from
  });
  it('the first read starts when the drop ends, a late break stretches the window', () => {
    const w = buildWindows({
      order: ['a'],
      receivers: [r('a', 0, -1, 1.5)],
      plan: undefined,
      dropEnd,
      readSec: 0.6,
      tuning: T,
    });
    expect(w[0]?.from).toBeCloseTo(1.0);
    expect(w[0]?.to).toBeCloseTo(1.8); // min(1.5 + 0.3, 1.0 + 1.2)
  });
  it('a very late break caps the window at twice its length', () => {
    const w = buildWindows({
      order: ['a'],
      receivers: [r('a', 0, -1, 4)],
      plan: undefined,
      dropEnd,
      readSec: 0.6,
      tuning: T,
    });
    expect(w[0]?.from).toBeCloseTo(1.0);
    expect(w[0]?.to).toBeCloseTo(2.2);
  });
  it('reads follow the QB rhythm, not the break, for later receivers', () => {
    const recs = [r('a', 0), r('b', 3, -1, 3.0)];
    const w = buildWindows({
      order: ['a', 'b'],
      receivers: recs,
      plan: undefined,
      dropEnd,
      readSec: 0.6,
      tuning: T,
    });
    expect(w[0]?.to).toBeCloseTo(1.6);
    expect(w[1]?.from).toBeCloseTo(1.6); // max(prevTo 1.6, min(2.7, 1.0 + 0.6))
  });
  it('uses readWindowMin when readSec is short and dropEnd when no break', () => {
    const w = buildWindows({
      order: ['a'],
      receivers: [r('a', 0)],
      plan: undefined,
      dropEnd,
      readSec: 0.3,
      tuning: T,
    });
    expect(w[0]?.from).toBeCloseTo(1.0);
    expect(w[0]?.to).toBeCloseTo(1.45);
  });
  it('manual window is used as given, clamped, and advances prevTo', () => {
    const recs = [r('a', 0, -1, 1.5), r('b', 3, -1, 1.0)];
    const plan = { mode: 'progression' as const, windows: { a: { from: 0.2, to: 0.5 } } };
    const w = buildWindows({ order: ['a', 'b'], receivers: recs, plan, dropEnd, readSec: 0.6, tuning: T });
    expect(w[0]).toMatchObject({ auto: false, from: 1.0 });
    expect(w[0]?.to).toBeCloseTo(1.45); // to <= from -> from + min
    expect(w[1]?.from).toBeCloseTo(1.45);
    const manual = buildWindows({
      order: ['a'],
      receivers: recs,
      plan: { mode: 'progression', windows: { a: { from: 1.3, to: 2.2 } } },
      dropEnd,
      readSec: 0.6,
      tuning: T,
    });
    expect(manual[0]).toMatchObject({ from: 1.3, to: 2.2, auto: false });
  });
});

describe('predictedSeparation', () => {
  const base = { catchPt: { x: 0, y: 10 }, pT: 1, tuning: T };
  it('5 yd defender with 0.8 s flight leaves 1.5 yd', () => {
    const s = predictedSeparation({ ...base, tRelease: 1, tArrive: 1.8, defenders: [def(5, 10)] });
    expect(s).toBeCloseTo(1.5);
  });
  it('longer flights close more, never negative', () => {
    const s = predictedSeparation({ ...base, tRelease: 1, tArrive: 2.5, defenders: [def(5, 10)] });
    expect(s).toBe(0);
  });
  it('extrapolates defender velocity to release', () => {
    const s = predictedSeparation({ ...base, tRelease: 2, tArrive: 2.3, defenders: [def(8, 10, -2, 0)] });
    expect(s).toBeCloseTo(6); // at x=6, no reach
  });
  it('returns Infinity with no defenders and min over several', () => {
    expect(predictedSeparation({ ...base, tRelease: 1, tArrive: 1.8, defenders: [] })).toBe(Infinity);
    const s = predictedSeparation({
      ...base,
      tRelease: 1,
      tArrive: 1.3,
      defenders: [def(9, 10), def(4, 10)],
    });
    expect(s).toBeCloseTo(4);
  });
});

describe('laneRisk', () => {
  const from: Point = { x: 0, y: 0 };
  const catchPt: Point = { x: 0, y: 10 };
  it('defender on the ball line -> 1; 1.5 yd away -> 0', () => {
    expect(laneRisk(from, catchPt, [{ x: 0, y: 5 }], 1.5)).toBe(1);
    expect(laneRisk(from, catchPt, [{ x: 1.5, y: 5 }], 1.5)).toBeCloseTo(0);
    expect(laneRisk(from, catchPt, [{ x: 0.75, y: 5 }], 1.5)).toBeCloseTo(0.5);
  });
  it('ignores the last yard near the catch point', () => {
    expect(laneRisk(from, catchPt, [{ x: 0, y: 10 }], 0.9)).toBe(0);
  });
  it('laneRadius 0 -> 0; no defenders -> 0', () => {
    expect(laneRisk(from, catchPt, [{ x: 0, y: 5 }], 0)).toBe(0);
    expect(laneRisk(from, catchPt, [], 1.5)).toBe(0);
  });
});

describe('readScore / minScoreFor', () => {
  it('formula and clamps', () => {
    expect(readScore(4, 15, 0, T)).toBeCloseTo(100);
    expect(readScore(2, 7.5, 0, T)).toBeCloseTo(50);
    expect(readScore(20, 99, 0, T)).toBeCloseTo(100);
    expect(readScore(0, 0, 1, T)).toBe(0);
    expect(readScore(4, 15, 1, T)).toBeCloseTo(((0.85 - 0.15) / 0.85) * 100, 5);
    expect(readScore(4, 15, 1, T)).toBeLessThan(readScore(4, 15, 0, T));
  });
  it('minScoreFor prefers plan override', () => {
    expect(minScoreFor('a', undefined, T)).toBe(55);
    expect(minScoreFor('a', { mode: 'progression', minScore: { a: 70 } }, T)).toBe(70);
    expect(minScoreFor('b', { mode: 'progression', minScore: { a: 70 } }, T)).toBe(55);
  });
});
