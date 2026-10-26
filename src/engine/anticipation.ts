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
import { createDefaultRoutePriors } from '@/domain/defaults';
import type { RoutePriorKey } from '@/domain/defaults';
import { distance, lerpPoint, pathLength, pointAtDistance } from '@/domain/geometry';
import { ROUTE_TEMPLATE_IDS, buildRoute } from '@/domain/routeTree';
import type { RouteTemplateId } from '@/domain/routeTree';
import type { ID, LateralSide, Point, RoutePriorTable, TuningParams } from '@/domain/types';
import type { PerceivedPlayer, Rng } from './types';

/** Average speed (yd/s) used to place a template route in time. */
export const TEMPLATE_SPEED = 6.5;
/** Likelihood σ (yd) for the Bayes update of route beliefs. */
export const BELIEF_SIGMA = 1.5;
/** Probability floor so no route is ever ruled out completely. */
export const BELIEF_FLOOR = 1e-4;
/** Seen speed must fall to this fraction of the reference speed to count as a deceleration tell. */
export const TELL_DROP = 0.85;
/** Reference speed (yd/s) below which a receiver is considered not running (no tell). */
export const TELL_MIN_SPEED = 2;
/** Number of tellFactor calls (ticks) an episode keeps its factor. */
export const TELL_HOLD_TICKS = 30;
/** Reaction multiplier when a tell is read. */
export const TELL_REACTION_FACTOR = 0.5;

/** Prior-table key for a receiver at the snap: #1 with ≤ 6 yd to its sideline → 'n1-tight', etc. */
export function priorKeyFor(
  number: 1 | 2 | 3 | null,
  isBackfieldRb: boolean,
  sidelineDistance: number,
): RoutePriorKey {
  if (isBackfieldRb) return 'rb';
  if (number === 1) return sidelineDistance <= 6 ? 'n1-tight' : 'n1-wide';
  if (number === 2) return 'n2-slot';
  return 'n3';
}

interface TemplatePath {
  pts: Point[];
  len: number;
  /** Unit heading of the last non-degenerate segment (for 'continue'); null when 'stop'. */
  extend: Point | null;
}

function buildTemplatePath(templateId: RouteTemplateId, start: Point, outward: 1 | -1): TemplatePath {
  const route = buildRoute(templateId, start, { outward });
  const pts: Point[] = [{ x: start.x, y: start.y }, ...route.path];
  const len = pathLength(pts);
  let extend: Point | null = null;
  if (route.endBehavior === 'continue') {
    for (let i = pts.length - 1; i > 0; i--) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      const d = distance(a, b);
      if (d > 1e-9) {
        extend = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
        break;
      }
    }
  }
  return { pts, len, extend };
}

function posOnPath(tp: TemplatePath, t: number): Point {
  const d = Math.max(0, t) * TEMPLATE_SPEED;
  if (d <= tp.len) return pointAtDistance(tp.pts, d);
  const last = tp.pts[tp.pts.length - 1] as Point;
  if (!tp.extend) return { x: last.x, y: last.y };
  const over = d - tp.len;
  return { x: last.x + tp.extend.x * over, y: last.y + tp.extend.y * over };
}

/**
 * Position of a template route at time t after the snap for a receiver starting at `start`, moving at
 * TEMPLATE_SPEED along buildRoute(templateId, start, { outward }) (default depth); after the path,
 * 'continue' extends the last heading, 'stop' stays.
 */
export function templatePosAt(templateId: RouteTemplateId, start: Point, outward: 1 | -1, t: number): Point {
  return posOnPath(buildTemplatePath(templateId, start, outward), t);
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
  const ids = ROUTE_TEMPLATE_IDS.filter((id) => (opts.prior[id] ?? 0) > 0);
  const use: readonly RouteTemplateId[] = ids.length > 0 ? ids : ROUTE_TEMPLATE_IDS;
  const paths = use.map((id) => buildTemplatePath(id, opts.start, opts.outward));
  let p = use.map((id) => (ids.length > 0 ? (opts.prior[id] as number) : 1));
  const normalize = (v: number[]): number[] => {
    const sum = v.reduce((a, b) => a + b, 0);
    return v.map((x) => x / sum);
  };
  p = normalize(p);
  const inv2s2 = 1 / (2 * BELIEF_SIGMA * BELIEF_SIGMA);

  return {
    observe(pos, tObs) {
      const next = p.map((pi, i) => {
        const tp = paths[i] as TemplatePath;
        const d = distance(pos, posOnPath(tp, tObs));
        return Math.max(BELIEF_FLOOR, pi * Math.exp(-d * d * inv2s2));
      });
      p = normalize(next);
    },
    probabilities() {
      const out: Record<string, number> = {};
      use.forEach((id, i) => {
        out[id] = p[i] as number;
      });
      return out;
    },
    expectedPosAt(t) {
      let x = 0;
      let y = 0;
      paths.forEach((tp, i) => {
        const q = posOnPath(tp, t);
        const pi = p[i] as number;
        x += pi * q.x;
        y += pi * q.y;
      });
      return { x, y };
    },
  };
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
   * An episode keeps its factor for TELL_HOLD_TICKS calls (`state.until` counts the calls left).
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
  /** Calls (ticks) left in the current episode. */
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
  const a = Math.min(1, Math.max(0, opts.a));
  const readingEnabled = a > 0;
  const oracleEnabled = a > 0.5;
  const oracle = oracleEnabled ? opts.oracle : null;
  const byId = new Map(opts.receivers.map((r) => [r.id, r]));
  const fallbackPriors = createDefaultRoutePriors();

  return {
    a,
    readingEnabled,
    oracleEnabled,
    createBelief(receiverId) {
      if (!readingEnabled) return null;
      const r = byId.get(receiverId);
      if (!r) return null;
      const prior = opts.priors[r.key] ?? fallbackPriors[r.key] ?? {};
      return createRouteBelief({ start: r.start, outward: r.outward, prior });
    },
    aim(seen, belief, t, iq, tuning) {
      const la = tuning.lookahead;
      const reactive: Point = { x: seen.pos.x + seen.vel.x * la, y: seen.pos.y + seen.vel.y * la };
      if (a <= 0) return reactive;
      const prior = belief ? belief.expectedPosAt(t + la) : reactive;
      if (a <= 0.5) return lerpPoint(reactive, prior, (a / 0.5) * iq);
      const mixed = lerpPoint(reactive, prior, iq);
      const truth = oracle ? oracle(seen.id, t + la) : undefined;
      return truth ? lerpPoint(mixed, truth, (a - 0.5) / 0.5) : mixed;
    },
    tellFactor(state, seen, prevSeenSpeed, iq, rng) {
      if (!readingEnabled) return 1;
      if (state.until > 0) {
        state.until -= 1;
        if (state.until === 0) {
          state.active = false;
          state.factor = 1;
          return 1;
        }
        return state.factor;
      }
      if (prevSeenSpeed === null || prevSeenSpeed < TELL_MIN_SPEED) return 1;
      const speed = Math.hypot(seen.vel.x, seen.vel.y);
      if (speed > prevSeenSpeed * TELL_DROP) return 1;
      state.active = true;
      state.factor = rng() < iq ? TELL_REACTION_FACTOR : 1;
      state.until = TELL_HOLD_TICKS;
      return state.factor;
    },
  };
}
