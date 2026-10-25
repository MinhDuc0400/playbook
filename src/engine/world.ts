/** World snapshots + history buffer (SRS §8.3). Pure data helpers; only simulate.ts owns a World. */
import { notImplemented } from '@/domain/notImplemented';
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
  return notImplemented(`createHistory ${first.t}`);
}

/** Append; throws if t is not strictly increasing. */
export function pushSnapshot(h: History, s: Snapshot): void {
  return notImplemented(`pushSnapshot ${h.snapshots.length}${s.t}`);
}

/**
 * Snapshot at time t: before the first → the first; after the last → the last; else player pos/vel
 * linearly interpolated between the two neighbours; ball/qb flags taken from the earlier neighbour
 * (discrete state never "leaks" early). O(log n).
 */
export function snapshotAt(h: History, t: number): Snapshot {
  return notImplemented(`snapshotAt ${h.snapshots.length}${t}`);
}

/** One player's pos/vel at t (interpolated as above); undefined if unknown. */
export function playerAt(h: History, id: ID, t: number): PlayerSnapshot | undefined {
  return notImplemented(`playerAt ${h.snapshots.length}${id}${t}`);
}
