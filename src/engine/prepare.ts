/** Pre-snap preparation (SRS §8.2 steps 2–4, FR-ENG-02, D-10). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { Numbering } from '@/domain/numbering';
import type { ID, Play, SimInput, Stats } from '@/domain/types';
import type { RoutePlan } from './routeFollower';
import type { DefenderBinding, FieldInfo } from './types';

export interface PreparedSim {
  offense: Play; // as given (flips already applied by the caller)
  defense: Play;
  info: FieldInfo;
  /** Offense numbering from alignment at the snap (strength computed from positions, D-09). */
  numbering: Numbering;
  /** Defender slot id → binding. Unresolvable man target → zone hookZoneForX(defender start.x), fallback: true. */
  bindings: Record<ID, DefenderBinding>;
  /** All players' stats after noise. */
  stats: Record<ID, Stats>;
  /** Offense receivers' route plans (first RouteAction), by slot id. */
  plans: Record<ID, RoutePlan>;
  qbId: ID | null;
  /** Human-readable warnings (English, engine-level), e.g. "CB2: man target weak #2 not found → hook-L". */
  warnings: string[];
}

/** Stats keys clamped to [0, 1] after noise. */
export const UNIT_STATS = ['cutLoss', 'iq', 'hands', 'ballSkills', 'accuracy', 'eyeDiscipline'] as const;

/**
 * - info: sidelines from sidelineBounds, minY/maxY from fieldBounds (src/domain/field.ts).
 * - numbering = numberReceivers(alignedPlayers(offense)) (computed strength, not Play.strength).
 * - bindings per defense slot from its first coverage/rush action: man → resolveReceiverRef (missing →
 *   fallback zone + warning); zone → polygon via zonePolygon(zone, field), dropPoint, deep = isDeepZone;
 *   rush → path + delay (default 0); spy → QB id; none → { kind: 'none' }.
 * - stats: input stats by slot id (missing → DEFAULT_PRESETS.avg). If input.noise: every stat × uniform
 *   [0.9, 1.1) from forkRng(seed, 'noise:' + slotId) in STAT_KEYS order; UNIT_STATS clamped to [0, 1].
 * - plans: planRoute(slot.id, slot.start, route) for offense slots with a RouteAction.
 */
export function prepareSim(input: SimInput): PreparedSim {
  return notImplemented(`prepareSim ${input.seed}`);
}
