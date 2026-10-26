/**
 * Anticipation (SRS §8.7, FR-ENG-08). The ONLY engine module allowed to read the opponent's play, and
 * only for the oracle (a > 0.5) — via an offense-only kinematic run handed in by simulate().
 *
 *   reactiveAim = seen.pos + seen.vel * lookahead
 *   priorAim    = Σ P(route | obs) * template(route).posAt(t + lookahead)
 *   oracleAim   = target.truePosAt(t + lookahead)
 *   a ≤ 0.5: aim = lerp(reactiveAim, priorAim, (a / 0.5) * iq)
 *   a > 0.5: aim = lerp(lerp(reactiveAim, priorAim, iq), oracleAim, (a − 0.5) / 0.5)
 */
import { notImplemented } from '@/domain/notImplemented';
import type { RoutePriorKey } from '@/domain/defaults';
import type { RouteTemplateId } from '@/domain/routeTree';
import type { ID, LateralSide, Point, RoutePriorTable, TuningParams } from '@/domain/types';
import type { PerceivedPlayer, Rng } from './types';

/** Average speed (yd/s) used to place a template route in time. */
export const TEMPLATE_SPEED = 6.5;
/** Likelihood σ (yd) for the Bayes update of route beliefs. */
export const BELIEF_SIGMA = 1.5;
/** Probability floor so no route is ever ruled out completely. */
export const BELIEF_FLOOR = 1e-4;

/** Prior-table key for a receiver at the snap: #1 with ≤ 6 yd to its sideline → 'n1-tight', etc. */
export function priorKeyFor(
  number: 1 | 2 | 3 | null,
  isBackfieldRb: boolean,
  sidelineDistance: number,
): RoutePriorKey {
  return notImplemented(`priorKeyFor ${String(number)}${isBackfieldRb}${sidelineDistance}`);
}

/**
 * Position of a template route at time t after the snap for a receiver starting at `start`, moving at
 * TEMPLATE_SPEED along buildRoute(templateId, start, { outward }) (default depth); after the path,
 * 'continue' extends the last heading, 'stop' stays.
 */
export function templatePosAt(templateId: RouteTemplateId, start: Point, outward: 1 | -1, t: number): Point {
  return notImplemented(`templatePosAt ${templateId}${start.x}${outward}${t}`);
}

/** Per-defender belief over one receiver's route. */
export interface RouteBelief {
  /** Bayes update from a perceived position at perceived time tObs: p *= exp(−d²/2σ²), floor, normalize. */
  observe(pos: Point, tObs: number): void;
  probabilities(): Record<string, number>;
  /** Σ p × templatePosAt(route, start, outward, t). */
  expectedPosAt(t: number): Point;
}

export function createRouteBelief(opts: {
  start: Point;
  outward: 1 | -1;
  prior: Record<string, number>; // templateId → probability (row of RoutePriorTable)
}): RouteBelief {
  return notImplemented(`createRouteBelief ${String(opts)}`);
}

export interface AnticipationModel {
  a: number;
  /** True when a > 0: route prior, deceleration tells and QB-eye drift are on. */
  readingEnabled: boolean;
  /** True when a > 0.5 (UI shows "Oracle: defense biết trước"). */
  oracleEnabled: boolean;
  /** New belief for a receiver id (null when the receiver is unknown, e.g. not an offense receiver). */
  createBelief(receiverId: ID): RouteBelief | null;
  /**
   * §8.7 blend for one defender looking at `seen` at sim time t (belief may be null → priorAim = reactive).
   * Oracle term uses the true future position at t + lookahead.
   */
  aim(seen: PerceivedPlayer, belief: RouteBelief | null, t: number, iq: number, tuning: TuningParams): Point;
  /**
   * Deceleration tell (§8.7 "Tín hiệu giảm tốc"): returns the reaction multiplier for that target this tick —
   * 0.5 when reading is enabled, the seen target is decelerating before a break (seen speed dropped ≥ 15 %
   * vs `prevSeenSpeed`) and an rng draw < iq (one draw per tell episode), else 1.
   */
  tellFactor(
    state: TellState,
    seen: PerceivedPlayer,
    prevSeenSpeed: number | null,
    iq: number,
    rng: Rng,
  ): number;
}

/** Per (defender, target) tell memory: active episode and its factor. */
export interface TellState {
  active: boolean;
  factor: number;
  until: number;
}

export function createTellState(): TellState {
  return { active: false, factor: 1, until: 0 };
}

/**
 * Build the model. `receivers` = offense receivers at the snap with their prior key and outward sign;
 * `oracle` = true future position (offense-only kinematic run) or null; only used when a > 0.5.
 */
export function createAnticipation(opts: {
  a: number;
  priors: RoutePriorTable;
  receivers: { id: ID; start: Point; outward: 1 | -1; key: RoutePriorKey; side: LateralSide }[];
  oracle: ((receiverId: ID, t: number) => Point | undefined) | null;
}): AnticipationModel {
  return notImplemented(`createAnticipation ${opts.a}`);
}
