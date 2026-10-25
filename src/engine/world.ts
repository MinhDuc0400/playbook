/** World snapshots + history buffer (SRS §8.3). Pure data helpers; only simulate.ts owns a World. */
import type { BallState, ID, Point } from '@/domain/types';

export interface PlayerSnapshot {
  pos: Point;
  vel: Point;
}

export interface Snapshot {
  t: number;
  players: Record<ID, PlayerSnapshot>;
  ball: BallState;
  qb: { id: ID | null; eyeTarget?: ID; throwStarted: boolean };
}

/** Append-only buffer of snapshots in increasing t. */
export interface History {
  snapshots: Snapshot[];
}

export function createHistory(first: Snapshot): History {
  return { snapshots: [first] };
}

/** Append; throws if t is not strictly increasing. */
export function pushSnapshot(h: History, s: Snapshot): void {
  const last = h.snapshots[h.snapshots.length - 1];
  if (last && !(s.t > last.t)) {
    throw new Error(`pushSnapshot: t must be strictly increasing (${s.t} <= ${last.t})`);
  }
  h.snapshots.push(s);
}

/**
 * Index of the last snapshot with time ≤ t among those with time ≤ cap; 0 when t is before the first
 * (or nothing is within the cap). Binary search, O(log n).
 */
function indexAtOrBefore(snaps: Snapshot[], t: number, cap: number): number {
  let lo = 0;
  let hi = snaps.length - 1;
  // Restrict to snapshots not after the cap.
  if ((snaps[hi]?.t ?? 0) > cap) {
    let a = 0;
    let b = hi;
    while (a < b) {
      const m = (a + b + 1) >> 1;
      if ((snaps[m] as Snapshot).t <= cap) a = m;
      else b = m - 1;
    }
    hi = a;
  }
  const limit = hi;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if ((snaps[m] as Snapshot).t <= t) lo = m;
    else hi = m - 1;
  }
  return Math.min(lo, limit);
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpPlayer(a: PlayerSnapshot, b: PlayerSnapshot, k: number): PlayerSnapshot {
  return {
    pos: { x: lerp(a.pos.x, b.pos.x, k), y: lerp(a.pos.y, b.pos.y, k) },
    vel: { x: lerp(a.vel.x, b.vel.x, k), y: lerp(a.vel.y, b.vel.y, k) },
  };
}

/**
 * Snapshot at time t: before the first → the first; after the last → the last; else player pos/vel
 * linearly interpolated between the two neighbours; ball/qb flags taken from the earlier neighbour
 * (discrete state never "leaks" early). O(log n).
 */
export function snapshotAt(h: History, t: number): Snapshot {
  const snaps = h.snapshots;
  const i = indexAtOrBefore(snaps, t, Infinity);
  const a = snaps[i] as Snapshot;
  const b = snaps[i + 1];
  if (!b || t <= a.t) return a;
  const k = (t - a.t) / (b.t - a.t);
  const players: Record<ID, PlayerSnapshot> = {};
  for (const id of Object.keys(a.players)) {
    const pa = a.players[id] as PlayerSnapshot;
    const pb = b.players[id];
    players[id] = pb ? lerpPlayer(pa, pb, k) : pa;
  }
  return { t, players, ball: a.ball, qb: a.qb };
}

/**
 * Like {@link playerAt} but treats snapshots with time > cap as non-existent, so a lookup can never
 * read data from beyond the caller's "now". Used by perception (anti-lookahead).
 */
export function playerAtCapped(h: History, id: ID, t: number, cap: number): PlayerSnapshot | undefined {
  const snaps = h.snapshots;
  const i = indexAtOrBefore(snaps, t, cap);
  const a = snaps[i] as Snapshot;
  const pa = a.players[id];
  const b = snaps[i + 1];
  if (!b || b.t > cap || t <= a.t) return pa ?? (b && b.t <= cap ? b.players[id] : undefined);
  const pb = b.players[id];
  if (!pa) return pb;
  if (!pb) return pa;
  return lerpPlayer(pa, pb, (t - a.t) / (b.t - a.t));
}

/** One player's pos/vel at t (interpolated as above); undefined if unknown. */
export function playerAt(h: History, id: ID, t: number): PlayerSnapshot | undefined {
  return playerAtCapped(h, id, t, Infinity);
}

/**
 * The snapshot in force at t, without interpolation: the last one with time ≤ t (the first when t is
 * before the start). Allocation-free; use for discrete state (ball, qb). O(log n).
 */
export function snapshotBefore(h: History, t: number): Snapshot {
  return h.snapshots[indexAtOrBefore(h.snapshots, t, Infinity)] as Snapshot;
}
