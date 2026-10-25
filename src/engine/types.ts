/**
 * Engine-internal types. Lead-owned contract (D-05). Phase 3 extends this file with AgentState,
 * Perception, Agent and assignments.
 */
import type { Point } from '@/domain/types';

/** Desired movement for one tick: heading (any length, normalized by the mover) + desired speed yd/s. */
export interface Intent {
  heading: Point;
  speed: number;
}

export interface Kinematic {
  pos: Point;
  vel: Point;
}

export interface MoveLimits {
  speed: number; // yd/s max
  accel: number; // s from 0 to max speed
  cutLoss: number; // 0..1 speed lost on a 180° cut
}
