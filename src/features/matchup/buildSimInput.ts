/** Matchup → SimInput (SRS §7.2, §8.1, FR-FLP-03/04). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { DbSnapshot, ID, Matchup, Play, Preset, Side, SimInput } from '@/domain/types';

export interface BuiltSim {
  input: SimInput;
  /** Plays after flips (what the engine and the field draw). */
  offense: Play;
  defense: Play;
  defenseFlipped: boolean;
}

/**
 * applyMatchupFlips(offense, defense, m) → flipped plays; offenseStats/defenseStats by slot id via
 * resolveStats(m, side, slot.label, ctx); field = ctx.settings.fields[offense.format]; tuning/routePriors
 * from ctx.settings; anticipation/seed/noise/ballSpot from the matchup.
 */
export function buildSimInput(m: Matchup, offense: Play, defense: Play, ctx: DbSnapshot): BuiltSim {
  return notImplemented(`buildSimInput ${m.id}${offense.id}${defense.id}${String(ctx)}`);
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
  return notImplemented(`createMatchup ${String(opts)}`);
}

/** FR-ATH-01: set (or replace) the preset override for (side, label); keeps any per-stat overrides. */
export function setOverridePreset(m: Matchup, side: Side, label: string, preset: Preset): Matchup {
  return notImplemented(`setOverridePreset ${m.id}${side}${label}${preset}`);
}

/** Current level of a player for the token ring (FR-ATH-02): classifyStats of its resolved stats. */
export function levelOf(stats: SimInput['offenseStats'][string], ctx: DbSnapshot): Preset | 'custom' {
  return notImplemented(`levelOf ${String(stats)}${String(ctx)}`);
}

/** Random 31-bit seed for the dice button (FR-MU-02). UI-side randomness is fine (not engine). */
export function randomSeed(): number {
  return notImplemented('randomSeed');
}
