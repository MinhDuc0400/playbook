/** Pre-snap preparation (SRS §8.2 steps 2–4, FR-ENG-02, D-10). Pure. */
import { fieldBounds, sidelineBounds } from '@/domain/field';
import { alignedPlayers, numberReceivers, resolveReceiverRef } from '@/domain/numbering';
import type { Numbering } from '@/domain/numbering';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { STAT_KEYS } from '@/domain/types';
import type { Action, ID, Play, PlayerSlot, ReceiverRef, RouteAction, SimInput, Stats } from '@/domain/types';
import { hookZoneForX, isDeepZone, zonePolygon, zonePreset } from '@/domain/zones';
import { forkRng, uniform } from './rng';
import { planRoute } from './routeFollower';
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
  const { offense, defense, field, ballSpot, tuning } = input;
  const { minX, maxX } = sidelineBounds(field, ballSpot);
  const bounds = fieldBounds(field, ballSpot);
  const info: FieldInfo = { field, ballSpot, minX, maxX, minY: bounds.minY, maxY: bounds.maxY, tuning };

  const numbering = numberReceivers(alignedPlayers(offense));
  const warnings: string[] = [];

  const bindings: Record<ID, DefenderBinding> = {};
  for (const slot of defense.players) {
    bindings[slot.id] = bindDefender(slot, numbering, input, warnings);
  }

  const stats: Record<ID, Stats> = {};
  for (const slot of offense.players) stats[slot.id] = resolveStats(slot.id, input.offenseStats, input);
  for (const slot of defense.players) stats[slot.id] = resolveStats(slot.id, input.defenseStats, input);

  const plans: Record<ID, RoutePlan> = {};
  for (const slot of offense.players) {
    const route = slot.actions.find((a): a is RouteAction => a.type === 'route');
    if (!route) continue;
    const plan = planRoute(slot.id, slot.start, route);
    if (plan) plans[slot.id] = plan;
  }

  return {
    offense,
    defense,
    info,
    numbering,
    bindings,
    stats,
    plans,
    qbId: numbering.qbId ?? null,
    warnings,
  };
}

/** Default man cushion (yd) when the action does not say. */
const DEFAULT_CUSHION = { cushion: 5, trail: 0 } as const;

type CoverageAction = Extract<Action, { type: 'man' | 'zone' | 'rush' | 'spy' }>;

function isCoverageAction(a: Action): a is CoverageAction {
  return a.type === 'man' || a.type === 'zone' || a.type === 'rush' || a.type === 'spy';
}

function describeRef(ref: ReceiverRef): string {
  return ref.kind === 'number' ? `${ref.side} #${ref.number}` : ref.role;
}

function bindDefender(
  slot: PlayerSlot,
  numbering: Numbering,
  input: SimInput,
  warnings: string[],
): DefenderBinding {
  const action = slot.actions.find(isCoverageAction);
  if (!action) return { kind: 'none' };
  switch (action.type) {
    case 'man': {
      const targetId = resolveReceiverRef(action.target, numbering);
      if (targetId !== null) {
        return {
          kind: 'man',
          targetId,
          technique: action.technique,
          cushion: action.cushion ?? DEFAULT_CUSHION[action.technique],
        };
      }
      const hook = hookZoneForX(slot.start.x);
      warnings.push(`${slot.label}: man target ${describeRef(action.target)} not found → ${hook}`);
      const shape = zonePreset(hook, input.field);
      return {
        kind: 'zone',
        polygon: shape.polygon,
        dropPoint: shape.dropPoint,
        deep: isDeepZone(hook),
        fallback: true,
      };
    }
    case 'zone':
      return {
        kind: 'zone',
        polygon: zonePolygon(action.zone, input.field),
        dropPoint: { x: action.dropPoint.x, y: action.dropPoint.y },
        deep: isDeepZone(action.zone),
        fallback: false,
      };
    case 'rush':
      return { kind: 'rush', path: action.path.map((p) => ({ x: p.x, y: p.y })), delay: action.delay ?? 0 };
    case 'spy':
      return { kind: 'spy', targetId: numbering.qbId ?? null };
  }
}

function resolveStats(slotId: ID, byId: Record<ID, Stats>, input: SimInput): Stats {
  const stats: Stats = { ...(byId[slotId] ?? DEFAULT_PRESETS.avg) };
  if (!input.noise) return stats;
  const rng = forkRng(input.seed, 'noise:' + slotId);
  for (const key of STAT_KEYS) {
    const v = stats[key] * uniform(rng, 0.9, 1.1);
    stats[key] = (UNIT_STATS as readonly string[]).includes(key) ? Math.min(1, Math.max(0, v)) : v;
  }
  return stats;
}
