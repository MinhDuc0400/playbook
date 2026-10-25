/** Stats resolution for a matchup position (SRS §7.2) and preset helpers. */
import { STAT_KEYS } from './types';
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
  const override = m.overrides.find((o) => o.side === side && o.label === label);
  const presets = ctx.settings.presets;

  let base: Stats | undefined;
  if (override?.preset) base = presets[override.preset];

  if (!base) {
    const lineupId = side === 'offense' ? m.offenseLineupId : m.defenseLineupId;
    const lineup = lineupId === undefined ? undefined : ctx.lineups[lineupId];
    const slot = lineup?.slots.find((s) => s.label === label);
    if (slot?.athleteId !== undefined) base = ctx.athletes[slot.athleteId]?.stats;
    if (!base && slot?.preset) base = presets[slot.preset];
  }

  const result: Stats = { ...(base ?? presets.avg) };
  if (override?.stats) {
    for (const key of STAT_KEYS) {
      const v = override.stats[key];
      if (v !== undefined) result[key] = v;
    }
  }
  return result;
}

/** QB read time per progression step: 0.8 − 0.5 × iq seconds (§7.1). */
export function readTime(iq: number): number {
  return 0.8 - 0.5 * iq;
}

/**
 * Which preset a stat block equals (all keys within 1e-6), else 'custom'. Drives the token ring colour
 * (FR-ATH-02): weak = red, avg = grey, good = green, custom = purple.
 */
export function classifyStats(stats: Stats, presets: Record<Preset, Stats>): Preset | 'custom' {
  const order: Preset[] = ['weak', 'avg', 'good'];
  for (const id of order) {
    const p = presets[id];
    if (STAT_KEYS.every((k) => Math.abs(stats[k] - p[k]) <= 1e-6)) return id;
  }
  return 'custom';
}
