/**
 * Engine-internal types. Lead-owned contract (D-05, D-10).
 * Agents only ever see their own state, their own assignment (closure), their stats and a delayed
 * Perception. Never the world, never the opponent's Play (§8.3).
 */
import type {
  BallSpot,
  FieldConfig,
  ID,
  Leverage,
  Point,
  ReceiverRef,
  Rng,
  Role,
  Side,
  SimEvent,
  Stats,
  TuningParams,
} from '@/domain/types';

export type { Rng };

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

/** What an agent knows about itself. */
export interface AgentState extends Kinematic {
  id: ID;
  side: Side;
  role: Role;
  label: string;
  stats: Stats; // after noise
  t: number; // current sim time (s since snap)
  hasBall: boolean;
  /** Offense receiver: true once the QB has thrown to this player (own team knowledge). */
  isBallTarget: boolean;
}

export interface PerceivedPlayer {
  id: ID;
  side: Side;
  role: Role;
  /** Receiver number as read by the defense at the snap (offense receivers only). */
  number?: ReceiverRef;
  pos: Point;
  vel: Point;
}

/** §8.3: what one player sees at time t, delayed by its reaction. */
export interface Perception {
  t: number; // the (delayed) time the snapshot represents
  others: PerceivedPlayer[];
  ball: { state: 'held' | 'inAir' | 'dead'; pos: Point; landing?: Point; tLand?: number };
  qb: { pos: Point; eyeTarget?: ID; throwStarted: boolean };
}

/** Static field information every agent may know. */
export interface FieldInfo {
  field: FieldConfig;
  ballSpot: BallSpot;
  minX: number; // sidelines (ball-relative)
  maxX: number;
  minY: number; // back of own end zone
  maxY: number; // back of opponent end zone
  tuning: TuningParams;
}

/** Agent output for one tick. Extends the SRS Intent (heading + speed). */
export interface AgentIntent extends Intent {
  /** Frame state label: 'route' | 'drop' | 'man' | 'zone' | 'rush' | 'ball' | 'idle' | … */
  state?: string;
  /** QB: current read / look (§8.5 eyeTarget). */
  eyeTarget?: ID;
  /** QB: decision to throw now; the world releases the ball after stats.release s (§8.5). */
  throw?: { targetId: ID; aim: Point };
  /** QB: throw the ball away now (outcome throwaway). */
  throwaway?: boolean;
  /** Man defender: target it is watching, for the leverage reaction factor next tick (§8.6). */
  focus?: { id: ID; leverage: Leverage | undefined };
  /** Extra events (break, read, pressure, ruleFired…); the world stamps t and playerId. */
  events?: Omit<SimEvent, 't'>[];
}

export interface Agent {
  id: ID;
  /** SRS §8.3 signature. Must be deterministic given (self, p, dt, rng draws). */
  step(self: AgentState, p: Perception, dt: number, rng: Rng): AgentIntent;
}

/** Defender assignment bound at the snap (§8.2.3). */
export type DefenderBinding =
  | { kind: 'man'; targetId: ID; technique: 'trail' | 'cushion'; cushion: number }
  | { kind: 'zone'; polygon: Point[]; dropPoint: Point; deep: boolean; fallback: boolean }
  | { kind: 'rush'; path: Point[]; delay: number }
  | { kind: 'spy'; targetId: ID | null }
  | { kind: 'none' };
