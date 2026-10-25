import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Point } from '@/domain/types';
import { applyThrowError, ballPosAt, flightTime, launchBall, leadTarget } from '../ball';
import { createRng } from '../rng';

const T = DEFAULT_TUNING;
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('flightTime (§8.8)', () => {
  it('18 yd at 18 yd/s takes 1 s', () => {
    expect(flightTime({ x: 0, y: 0 }, { x: 0, y: 18 }, T)).toBeCloseTo(1, 10);
  });
  it('uses euclidean distance and tuning.ballSpeed', () => {
    expect(flightTime({ x: 0, y: 0 }, { x: 3, y: 4 }, { ...T, ballSpeed: 10 })).toBeCloseTo(0.5, 10);
  });
  it('is 0 for identical points', () => {
    expect(flightTime({ x: 2, y: 2 }, { x: 2, y: 2 }, T)).toBe(0);
  });
});

describe('applyThrowError (§8.8)', () => {
  const sd = (xs: number[]): number => {
    const m = xs.reduce((s, v) => s + v, 0) / xs.length;
    return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
  };
  const sample = (d: number, acc: number, seed: number): { ex: number[]; ey: number[] } => {
    const rng = createRng(seed);
    const from = { x: 0, y: 0 };
    const aim = { x: 0, y: d };
    const ex: number[] = [];
    const ey: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      const p = applyThrowError(from, aim, acc, T, rng);
      ex.push(p.x - aim.x);
      ey.push(p.y - aim.y);
    }
    return { ex, ey };
  };

  it('sigma = (1 - accuracy) * inaccuracyK * distance on both axes (within 5 %)', () => {
    const { ex, ey } = sample(20, 0.6, 1);
    const expected = 0.4 * 0.05 * 20; // 0.4 yd
    expect(Math.abs(sd(ex) / expected - 1)).toBeLessThan(0.05);
    expect(Math.abs(sd(ey) / expected - 1)).toBeLessThan(0.05);
  });

  it('sigma scales linearly with distance', () => {
    const near = sd(sample(10, 0.5, 2).ex);
    const far = sd(sample(30, 0.5, 2).ex);
    expect(Math.abs(far / near / 3 - 1)).toBeLessThan(0.05);
  });

  it('sigma scales with (1 - accuracy)', () => {
    const a = sd(sample(20, 0.9, 3).ex);
    const b = sd(sample(20, 0.5, 3).ex);
    expect(Math.abs(b / a / 5 - 1)).toBeLessThan(0.05);
  });

  it('accuracy 1 gives no error', () => {
    const aim = { x: 3, y: 12 };
    expect(applyThrowError({ x: 0, y: 0 }, aim, 1, T, createRng(4))).toEqual(aim);
  });

  it('draws x first then y (two gaussians)', () => {
    const seq = [0.3, 0.7, 0.6, 0.2];
    let i = 0;
    const rng = () => seq[i++] ?? 0;
    const p = applyThrowError({ x: 0, y: 0 }, { x: 0, y: 10 }, 0, T, rng);
    expect(i).toBe(4);
    // sigma = 0.5; gx from (0.3, 0.7), gy from (0.6, 0.2)
    const g = (u1: number, u2: number): number =>
      Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
    expect(p.x).toBeCloseTo(0.5 * g(0.3, 0.7), 9);
    expect(p.y).toBeCloseTo(10 + 0.5 * g(0.6, 0.2), 9);
  });

  it('is deterministic per seed', () => {
    const a = applyThrowError({ x: 0, y: 0 }, { x: 5, y: 15 }, 0.7, T, createRng(8));
    const b = applyThrowError({ x: 0, y: 0 }, { x: 5, y: 15 }, 0.7, T, createRng(8));
    expect(a).toEqual(b);
  });
});

describe('launchBall / ballPosAt', () => {
  const from = { x: 0, y: -5 };
  const landing = { x: 4, y: 13 };
  const ball = launchBall(from, landing, 1.2, 'wr1', T);

  it('sets inAir state and all flight fields', () => {
    expect(ball.state).toBe('inAir');
    expect(ball.pos).toEqual(from);
    expect(ball.from).toEqual(from);
    expect(ball.landing).toEqual(landing);
    expect(ball.tThrow).toBe(1.2);
    expect(ball.tLand).toBeCloseTo(1.2 + dist(from, landing) / 18, 10);
    expect(ball.targetId).toBe('wr1');
  });

  it('midpoint is halfway between from and landing', () => {
    const mid = ballPosAt(ball, (ball.tThrow! + ball.tLand!) / 2);
    expect(mid.x).toBeCloseTo(2, 10);
    expect(mid.y).toBeCloseTo(4, 10);
  });

  it('clamps before tThrow and after tLand', () => {
    expect(ballPosAt(ball, 0)).toEqual(from);
    expect(ballPosAt(ball, 99)).toEqual(landing);
  });

  it('handles zero-length flight', () => {
    const b = launchBall(from, from, 0.5, 'x', T);
    expect(ballPosAt(b, 0.5)).toEqual(from);
    expect(ballPosAt(b, 3)).toEqual(from);
  });
});

describe('leadTarget', () => {
  it('converges for a receiver crossing at 7 yd/s: flight time matches |aim - from| / ballSpeed', () => {
    const from = { x: 0, y: -5 };
    const tRelease = 1.5;
    const posAt = (t: number): Point => ({ x: -8 + 7 * (t - tRelease), y: 10 });
    const { aim, tArrive } = leadTarget(from, tRelease, posAt, T);
    expect(Math.abs(dist(aim, from) / T.ballSpeed - (tArrive - tRelease))).toBeLessThan(0.01);
    expect(aim.x).toBeCloseTo(posAt(tArrive).x, 6);
    expect(aim.y).toBeCloseTo(posAt(tArrive).y, 6);
    expect(aim.x).toBeGreaterThan(-8); // led ahead of the current position
  });

  it('converges for a receiver running straight downfield at 7 yd/s', () => {
    const from = { x: 0, y: -5 };
    const posAt = (t: number): Point => ({ x: 3, y: 5 + 7 * t });
    const { aim, tArrive } = leadTarget(from, 0, posAt, T);
    expect(Math.abs(dist(aim, from) / T.ballSpeed - tArrive)).toBeLessThan(0.01);
  });

  it('stationary receiver: aim = position, tArrive = release + distance / speed', () => {
    const from = { x: 0, y: 0 };
    const { aim, tArrive } = leadTarget(from, 2, () => ({ x: 0, y: 18 }), T);
    expect(aim).toEqual({ x: 0, y: 18 });
    expect(tArrive).toBeCloseTo(3, 10);
  });
});
