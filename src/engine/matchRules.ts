/** Pattern-match rules (SRS §5.4, §8.6 "Luật match", FR-ENG-09). Pure. */
import { notImplemented } from '@/domain/notImplemented';
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
export function eventHolds(
  event: MatchEvent,
  seen: PerceivedPlayer,
  opts: { minDepth?: number; strongSign: 1 | -1 },
): boolean {
  return notImplemented(`eventHolds ${event}${seen.id}${String(opts)}`);
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
  return notImplemented(`evaluateRules ${opts.rules.length}`);
}

/** Helper for tests/UI: centre of a set of points. */
export function centroid(points: readonly Point[]): Point {
  return notImplemented(`centroid ${points.length}`);
}
