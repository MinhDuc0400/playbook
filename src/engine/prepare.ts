/** Pre-snap preparation (SRS §8.2 steps 2–4, FR-ENG-02, D-10). Pure. */
import { fieldBounds, sidelineBounds } from '@/domain/field';
import { numberReceivers, resolveReceiverRef } from '@/domain/numbering';
import type { Numbering } from '@/domain/numbering';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { STAT_KEYS } from '@/domain/types';
import type {
  Action,
  ID,
  OptionRouteAction,
  Play,
  PlayerSlot,
  Point,
  ReceiverRef,
  RouteAction,
  SimInput,
  Stats,
} from '@/domain/types';
import { hookZoneForX, isDeepZone, zonePolygon, zonePreset } from '@/domain/zones';
import { forkRng, uniform } from './rng';
import { planMotion, planOption, planRoute } from './routeFollower';
import type { MotionPlan, OptionPlan, RoutePlan } from './routeFollower';
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
  /** Offense receivers' route plans (first RouteAction), by slot id; they start at the motion end, if any. */
  plans: Record<ID, RoutePlan>;
  /** Offense option-route plans (first action is an OptionRouteAction), by slot id. Excluded from `plans`. */
  options: Record<ID, OptionPlan>;
  /** Pre-snap motion plans, by slot id (D-08: the route/option starts at the motion end). */
  motions: Record<ID, MotionPlan>;
  /** Longest motion duration over the offense (s); 0 without motion. The sim starts at t = −this. */
  motionDuration: number;
  /** Offense alignment at the snap: motion end, else the slot start. */
  snapStart: Record<ID, Point>;
  qbId: ID | null;
  /** Human-readable warnings (English, engine-level), e.g. "CB2: man target weak #2 not found → hook-L". */
  warnings: string[];
}

/** Stats keys clamped to [0, 1] after noise. */
export const UNIT_STATS = ['cutLoss', 'iq', 'hands', 'ballSkills', 'accuracy', 'eyeDiscipline'] as const;

/**
 * - info: sidelines from sidelineBounds, minY/maxY from fieldBounds (src/domain/field.ts).
 * - numbering = numberReceivers(alignment at the snap = motion end) (computed strength, not Play.strength);
 *   defenders therefore bind to post-motion numbers ("đánh số lại", §8.2.5).
 * - bindings per defense slot from its first coverage/rush action: man → resolveReceiverRef (missing →
 *   fallback zone + warning); zone → polygon via zonePolygon(zone, field), dropPoint, deep = isDeepZone;
 *   rush → path + delay (default 0); spy → QB id; none → { kind: 'none' }.
 * - stats: input stats by slot id (missing → DEFAULT_PRESETS.avg). If input.noise: every stat × uniform
 *   [0.9, 1.1) from forkRng(seed, 'noise:' + slotId) in STAT_KEYS order; UNIT_STATS clamped to [0, 1].
 * - motions: planMotion per offense slot; plans: planRoute from the motion end for slots whose first
 *   route-like action is a RouteAction (delay passed through); options: planOption for an OptionRouteAction.
 */
export function prepareSim(input: SimInput): PreparedSim {
  const { offense, defense, field, ballSpot, tuning } = input;
  const { minX, maxX } = sidelineBounds(field, ballSpot);
  const bounds = fieldBounds(field, ballSpot);
  const info: FieldInfo = { field, ballSpot, minX, maxX, minY: bounds.minY, maxY: bounds.maxY, tuning };

  const motions: Record<ID, MotionPlan> = {};
  const snapStart: Record<ID, Point> = {};
  let motionDuration = 0;
  for (const slot of offense.players) {
    const motion = planMotion(slot.id, slot.start, slot.actions);
    if (motion) {
      motions[slot.id] = motion;
      motionDuration = Math.max(motionDuration, motion.duration);
    }
    const at = motion ? motion.end : slot.start;
    snapStart[slot.id] = { x: at.x, y: at.y };
  }
  const numbering = numberReceivers(
    offense.players.map((s) => ({ id: s.id, role: s.role, pos: snapStart[s.id] as Point })),
  );
  const warnings: string[] = [];

  const bindings: Record<ID, DefenderBinding> = {};
  for (const slot of defense.players) {
    bindings[slot.id] = bindDefender(slot, numbering, input, warnings);
  }

  const stats: Record<ID, Stats> = {};
  for (const slot of offense.players) stats[slot.id] = resolveStats(slot.id, input.offenseStats, input);
  for (const slot of defense.players) stats[slot.id] = resolveStats(slot.id, input.defenseStats, input);

  const plans: Record<ID, RoutePlan> = {};
  const options: Record<ID, OptionPlan> = {};
  for (const slot of offense.players) {
    const first = slot.actions.find(
      (a): a is RouteAction | OptionRouteAction => a.type === 'route' || a.type === 'option',
    );
    if (!first) continue;
    const at = snapStart[slot.id] as Point;
    if (first.type === 'option') {
      options[slot.id] = planOption(slot.id, at, first);
    } else {
      const plan = planRoute(slot.id, at, first);
      if (plan) plans[slot.id] = plan;
    }
  }

  return {
    offense,
    defense,
    info,
    numbering,
    bindings,
    stats,
    plans,
    options,
    motions,
    motionDuration,
    snapStart,
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
