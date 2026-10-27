/** Matchup → SimInput (SRS §7.2, §8.1, FR-FLP-03/04). Pure. */
import { DEFAULT_BALL_SPOT } from '@/domain/field';
import { applyMatchupFlips } from '@/domain/matchupFlip';
import { classifyStats, resolveStats } from '@/domain/stats';
import { SCHEMA_VERSION } from '@/domain/types';
import type { DbSnapshot, ID, Matchup, Play, Preset, Side, SimInput } from '@/domain/types';

export interface BuiltSim {
  input: SimInput;
  /** Plays after flips (what the engine and the field draw). */
  offense: Play;
  defense: Play;
  defenseFlipped: boolean;
}

function statsBySlot(play: Play, side: Side, m: Matchup, ctx: DbSnapshot): SimInput['offenseStats'] {
  const out: SimInput['offenseStats'] = {};
  for (const slot of play.players) out[slot.id] = resolveStats(m, side, slot.label, ctx);
  return out;
}

/**
 * applyMatchupFlips(offense, defense, m) → flipped plays; offenseStats/defenseStats by slot id via
 * resolveStats(m, side, slot.label, ctx); field = ctx.settings.fields[offense.format]; tuning/routePriors
 * from ctx.settings; anticipation/seed/noise/ballSpot from the matchup.
 */
export function buildSimInput(
  m: Matchup,
  offense: Play,
  defense: Play,
  ctx: DbSnapshot,
  simple?: boolean,
): BuiltSim {
  const flipped = applyMatchupFlips(offense, defense, m);
  /** Simple mode (D-26): everyone TB, no noise, seed 1, anticipation 0.5, QB auto. */
  const avgStats = (play: Play): SimInput['offenseStats'] => {
    const out: SimInput['offenseStats'] = {};
    for (const slot of play.players) out[slot.id] = { ...ctx.settings.presets.avg };
    return out;
  };
  const input: SimInput = {
    offense: flipped.offense,
    defense: flipped.defense,
    offenseStats: simple ? avgStats(flipped.offense) : statsBySlot(flipped.offense, 'offense', m, ctx),
    defenseStats: simple ? avgStats(flipped.defense) : statsBySlot(flipped.defense, 'defense', m, ctx),
    field: ctx.settings.fields[offense.format],
    ballSpot: m.ballSpot,
    anticipation: simple ? 0.5 : m.anticipation,
    seed: simple ? 1 : m.seed,
    noise: simple ? false : m.noise,
    ...(simple ? { qbControl: 'auto' as const } : {}),
    tuning: ctx.settings.tuning,
    routePriors: ctx.settings.routePriors,
  };
  return {
    input,
    offense: flipped.offense,
    defense: flipped.defense,
    defenseFlipped: flipped.defenseFlipped,
  };
}

/**
 * New matchup with defaults: offenseFlipped false, defenseFlip 'auto', overrides [], anticipation 0.5,
 * ballSpot DEFAULT_BALL_SPOT, seed = `seed` ?? 1, noise false, schemaVersion, createdAt = updatedAt = now.
 */
export function createMatchup(opts: {
  offensePlayId: ID;
  defensePlayId: ID;
  now: number;
  idGen: () => ID;
  seed?: number;
}): Matchup {
  return {
    id: opts.idGen(),
    schemaVersion: SCHEMA_VERSION,
    offensePlayId: opts.offensePlayId,
    offenseFlipped: false,
    defensePlayId: opts.defensePlayId,
    defenseFlip: 'auto',
    overrides: [],
    anticipation: 0.5,
    ballSpot: { ...DEFAULT_BALL_SPOT },
    seed: opts.seed ?? 1,
    noise: false,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** FR-ATH-01: set (or replace) the preset override for (side, label); keeps any per-stat overrides. */
export function setOverridePreset(m: Matchup, side: Side, label: string, preset: Preset): Matchup {
  const exists = m.overrides.some((o) => o.side === side && o.label === label);
  const overrides = exists
    ? m.overrides.map((o) => (o.side === side && o.label === label ? { ...o, preset } : o))
    : [...m.overrides, { side, label, preset }];
  return { ...m, overrides };
}

/** Current level of a player for the token ring (FR-ATH-02): classifyStats of its resolved stats. */
export function levelOf(stats: SimInput['offenseStats'][string], ctx: DbSnapshot): Preset | 'custom' {
  return classifyStats(stats, ctx.settings.presets);
}

/** Random 31-bit seed for the dice button (FR-MU-02). UI-side randomness is fine (not engine). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** True when the stored matchup carries settings that Simple mode ignores (D-26). */
export function hasCustomTuning(m: Matchup): boolean {
  return (
    m.overrides.length > 0 ||
    m.offenseLineupId !== undefined ||
    m.defenseLineupId !== undefined ||
    m.seed !== 1 ||
    m.noise
  );
}
