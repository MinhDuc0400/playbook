/** Pattern-match rules (SRS §5.4, §8.6 "Luật match", FR-ENG-09). Pure. */
import type { ID, MatchEvent, MatchRule, Point, ZonePresetId } from '@/domain/types';
import type { PerceivedPlayer } from './types';

/**
 * Event conditions on a PERCEIVED receiver (§8.6 table):
 * | release  | y > 0.5 (left the LOS) |
 * | vertical | |vy| / |v| ≥ 0.7 (vy > 0) and depth y ≥ minDepth (default 0) |
 * | out      | horizontal velocity toward its sideline (sign(vx) = sign(x)) with |vx|/|v| ≥ 0.6 |
 * | in       | horizontal velocity toward the ball with |vx|/|v| ≥ 0.6 and y > 6 |
 * | under    | horizontal toward the ball (|vx|/|v| ≥ 0.6) and y ≤ 6 |
 * | stop     | |v| < 1 yd/s (only after release) |
 * Receivers with |x| < 0.25 use their strong-side direction (`strongSign`) as "outside".
 */
const RELEASE_Y = 0.5;
const STOP_SPEED = 1;
const VERTICAL_RATIO = 0.7;
const LATERAL_RATIO = 0.6;
const SHALLOW_DEPTH = 6;
const ON_BALL_X = 0.25;
const IQ_DELAY = 0.3;
const EPS = 1e-9;

export function eventHolds(
  event: MatchEvent,
  seen: PerceivedPlayer,
  opts: { minDepth?: number; strongSign: 1 | -1 },
): boolean {
  const { x, y } = seen.pos;
  const { x: vx, y: vy } = seen.vel;
  const speed = Math.hypot(vx, vy);
  const minDepth = opts.minDepth ?? 0;
  if (y < minDepth) return false;
  const released = y > RELEASE_Y;
  if (event === 'release') return released;
  if (event === 'stop') return released && speed < STOP_SPEED;
  if (speed === 0) return false;
  if (event === 'vertical') return vy > 0 && vy / speed >= VERTICAL_RATIO;
  const outSign = Math.abs(x) < ON_BALL_X ? opts.strongSign : Math.sign(x);
  const outward = (vx * outSign) / speed;
  if (event === 'out') return outward >= LATERAL_RATIO;
  const inward = -outward;
  if (inward < LATERAL_RATIO) return false;
  return event === 'in' ? y > SHALLOW_DEPTH : y <= SHALLOW_DEPTH;
}

export type RuleOutcome =
  | { type: 'man'; targetId: ID }
  | { type: 'zone'; zone: ZonePresetId }
  | { type: 'carry'; receiverId: ID }
  | { type: 'passOff'; receiverId: ID };

/**
 * First rule (by ascending priority, ties by array order) whose `when` holds for its resolved receiver:
 * receiver ref resolved with `resolveRef`; beforeTime (if set) requires t < beforeTime; a defender with
 * iq < 1 only "recognises" an event once it has held continuously for (1 − iq) × 0.3 s (`heldSince`
 * map, keyed by rule id, maintained by the caller via the returned `held`). Already-fired rule ids are
 * skipped. Returns the rule + outcome or null, and the updated held map.
 */
export function evaluateRules(opts: {
  rules: readonly MatchRule[];
  perceived: readonly PerceivedPlayer[];
  resolveRef: (ref: MatchRule['when']['receiver']) => ID | null;
  t: number;
  iq: number;
  fired: ReadonlySet<ID>;
  heldSince: Readonly<Record<ID, number>>;
  strongSign: 1 | -1;
  resolveThenRef: (ref: MatchRule['when']['receiver']) => ID | null;
}): { fired: { rule: MatchRule; outcome: RuleOutcome } | null; heldSince: Record<ID, number> } {
  const delay = (1 - Math.min(1, Math.max(0, opts.iq))) * IQ_DELAY;
  const held: Record<ID, number> = { ...opts.heldSince };
  const ordered = [...opts.rules].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (opts.fired.has(rule.id)) continue;
    const { when } = rule;
    const id = opts.resolveRef(when.receiver);
    const seen = id === null ? undefined : opts.perceived.find((p) => p.id === id);
    const holds =
      seen !== undefined &&
      (when.beforeTime === undefined || opts.t < when.beforeTime) &&
      eventHolds(when.event, seen, { minDepth: when.minDepth, strongSign: opts.strongSign });
    if (!holds || seen === undefined) {
      delete held[rule.id];
      continue;
    }
    const since = held[rule.id] ?? opts.t;
    held[rule.id] = since;
    if (opts.t - since + EPS < delay) continue;
    const then = rule.then;
    let outcome: RuleOutcome;
    if (then.type === 'man') {
      const targetId = opts.resolveThenRef(then.target);
      if (targetId === null) continue;
      outcome = { type: 'man', targetId };
    } else if (then.type === 'zone') {
      outcome = { type: 'zone', zone: then.zone };
    } else {
      outcome = { type: then.type, receiverId: seen.id };
    }
    return { fired: { rule, outcome }, heldSince: held };
  }
  return { fired: null, heldSince: held };
}

/** Helper for tests/UI: centre of a set of points. */
export function centroid(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}
