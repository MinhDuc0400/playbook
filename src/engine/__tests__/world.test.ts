import { describe, expect, it } from 'vitest';
import { createHistory, playerAt, playerAtCapped, pushSnapshot, snapshotAt, type Snapshot } from '../world';

function snap(t: number, x: number, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    t,
    players: { a: { pos: { x, y: 2 * x }, vel: { x: 10 * x, y: -x } } },
    ball: { state: 'held', pos: { x, y: 0 } },
    qb: { id: 'a', throwStarted: false },
    ...extra,
  };
}

describe('world history (§8.3, FR-ENG-03)', () => {
  it('enforces strictly increasing push order', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(0.1, 1));
    expect(() => pushSnapshot(h, snap(0.1, 2))).toThrow();
    expect(() => pushSnapshot(h, snap(0.05, 2))).toThrow();
    expect(h.snapshots).toHaveLength(2);
  });

  it('returns the first snapshot before the start and the last after the end', () => {
    const h = createHistory(snap(1, 0));
    pushSnapshot(h, snap(2, 4));
    expect(snapshotAt(h, 0).t).toBe(1);
    expect(snapshotAt(h, -5).players['a']?.pos.x).toBe(0);
    expect(snapshotAt(h, 3).t).toBe(2);
    expect(snapshotAt(h, 3).players['a']?.pos.x).toBe(4);
  });

  it('returns the exact snapshot values on a sample time', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(1, 4));
    pushSnapshot(h, snap(2, 8));
    expect(snapshotAt(h, 1).players['a']?.pos).toEqual({ x: 4, y: 8 });
  });

  it('interpolates pos and vel linearly between neighbours', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(1, 4));
    const s = snapshotAt(h, 0.25);
    expect(s.t).toBe(0.25);
    expect(s.players['a']?.pos.x).toBeCloseTo(1, 12);
    expect(s.players['a']?.pos.y).toBeCloseTo(2, 12);
    expect(s.players['a']?.vel.x).toBeCloseTo(10, 12);
    expect(s.players['a']?.vel.y).toBeCloseTo(-1, 12);
    expect(playerAt(h, 'a', 0.5)?.pos.x).toBeCloseTo(2, 12);
  });

  it('takes ball and qb discrete state from the earlier neighbour', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(
      h,
      snap(1, 4, {
        ball: { state: 'inAir', pos: { x: 9, y: 9 }, landing: { x: 5, y: 5 }, tLand: 2 },
        qb: { id: 'a', eyeTarget: 'b', throwStarted: true },
      }),
    );
    const mid = snapshotAt(h, 0.99);
    expect(mid.ball.state).toBe('held');
    expect(mid.qb.throwStarted).toBe(false);
    expect(mid.qb.eyeTarget).toBeUndefined();
    const at = snapshotAt(h, 1);
    expect(at.ball.state).toBe('inAir');
    expect(at.qb.throwStarted).toBe(true);
  });

  it('playerAt returns undefined for unknown ids', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(1, 4));
    expect(playerAt(h, 'zzz', 0.5)).toBeUndefined();
  });

  it('keeps a player present only in the earlier snapshot at its last known state', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(1, 4, { players: { b: { pos: { x: 1, y: 1 }, vel: { x: 0, y: 0 } } } }));
    expect(playerAt(h, 'a', 0.5)?.pos.x).toBe(0);
  });

  it('playerAtCapped never reads a snapshot after the cap', () => {
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(1, 4));
    expect(playerAtCapped(h, 'a', 0.5, 1)?.pos.x).toBeCloseTo(2, 12);
    expect(playerAtCapped(h, 'a', 0.5, 0.6)?.pos.x).toBe(0);
    expect(playerAtCapped(h, 'a', 0.5, 0.5)?.pos.x).toBe(0);
    expect(playerAtCapped(h, 'a', 0.5, -1)?.pos.x).toBe(0);
  });

  it('looks up in a 10k-snapshot history quickly and correctly', () => {
    const h = createHistory(snap(0, 0));
    for (let i = 1; i < 10000; i++) pushSnapshot(h, snap(i / 60, i));
    const t0 = performance.now();
    for (let k = 0; k < 20000; k++) {
      const t = (k % 9990) / 60 + 0.004;
      const p = playerAt(h, 'a', t);
      expect(p?.pos.x).toBeCloseTo(t * 60, 6);
    }
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('snapshotBefore', () => {
  it('returns the earlier neighbour without interpolation', async () => {
    const { snapshotBefore } = await import('../world');
    const h = createHistory(snap(0, 0));
    pushSnapshot(h, snap(1, 4));
    expect(snapshotBefore(h, 0.99)).toBe(h.snapshots[0]);
    expect(snapshotBefore(h, 1)).toBe(h.snapshots[1]);
    expect(snapshotBefore(h, -3)).toBe(h.snapshots[0]);
    expect(snapshotBefore(h, 9)).toBe(h.snapshots[1]);
  });
});
