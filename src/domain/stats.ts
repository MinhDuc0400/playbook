/** Stats resolution for a matchup position (SRS §7.2) and preset helpers. */
import { notImplemented } from './notImplemented';
import type { DbSnapshot, Matchup, Preset, Side, Stats } from './types';

/**
 * Resolve stats for the player with `label` on `side`, in this priority (§7.2):
 * 1. Matchup.overrides[].stats (per-stat, on top of everything below)
 * 2. Matchup.overrides[].preset
 * 3. Lineup (offenseLineupId / defenseLineupId) → slot with same label → athleteId → Athlete.stats
 * 4. Lineup → slot with same label → preset
 * 5. Settings.presets.avg
 * Preset values always come from ctx.settings.presets (user-editable), not DEFAULT_PRESETS.
 * Noise is NOT applied here (engine, seeded RNG).
 */
export function resolveStats(m: Matchup, side: Side, label: string, ctx: DbSnapshot): Stats {
  return notImplemented(`resolveStats ${m.id}${side}${label}${String(ctx)}`);
}

/** QB read time per progression step: 0.8 − 0.5 × iq seconds (§7.1). */
export function readTime(iq: number): number {
  return notImplemented(`readTime ${iq}`);
}

/**
 * Which preset a stat block equals (all keys within 1e-6), else 'custom'. Drives the token ring colour
 * (FR-ATH-02): weak = red, avg = grey, good = green, custom = purple.
 */
export function classifyStats(stats: Stats, presets: Record<Preset, Stats>): Preset | 'custom' {
  return notImplemented(`classifyStats ${String(stats)}${String(presets)}`);
}
