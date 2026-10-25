import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '../defaults';
import { DEFAULT_PRESETS } from '../presets';
import { classifyStats, readTime, resolveStats } from '../stats';
import type { Athlete, DbSnapshot, Lineup, Matchup, Stats } from '../types';

function athlete(id: string, stats: Stats): Athlete {
  return {
    id,
    schemaVersion: 1,
    name: id,
    preset: 'custom',
    stats,
    positions: ['WR'],
    createdAt: 0,
    updatedAt: 0,
  };
}

function lineup(id: string, side: 'offense' | 'defense', slots: Lineup['slots']): Lineup {
  return { id, schemaVersion: 1, name: id, side, format: '5v5', slots, createdAt: 0, updatedAt: 0 };
}

function matchup(over: Partial<Matchup> = {}): Matchup {
  return {
    id: 'm1',
    schemaVersion: 1,
    offensePlayId: 'po',
    offenseFlipped: false,
    defensePlayId: 'pd',
    defenseFlip: 'auto',
    overrides: [],
    anticipation: 0.5,
    ballSpot: { x: 0, yardLine: 25 },
    seed: 1,
    noise: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const athleteStats: Stats = { ...DEFAULT_PRESETS.good, speed: 9.5, hands: 0.99 };

function makeCtx(): DbSnapshot {
  return {
    settings: createDefaultSettings(),
    lineups: {
      lo: lineup('lo', 'offense', [
        { label: 'X', athleteId: 'a1', preset: 'weak' },
        { label: 'Y', preset: 'weak' },
        { label: 'Z', athleteId: 'ghost', preset: 'good' },
      ]),
      ld: lineup('ld', 'defense', [{ label: 'X', preset: 'good' }]),
    },
    athletes: { a1: athlete('a1', athleteStats) },
  };
}

describe('T-DOM-08 resolveStats priority', () => {
  it('level 5: falls back to Settings.presets.avg', () => {
    expect(resolveStats(matchup(), 'offense', 'X', makeCtx())).toEqual(DEFAULT_PRESETS.avg);
  });

  it('level 5: honors an edited avg preset in ctx.settings', () => {
    const ctx = makeCtx();
    ctx.settings.presets.avg.speed = 7.7;
    expect(resolveStats(matchup(), 'offense', 'X', ctx).speed).toBe(7.7);
  });

  it('level 4: lineup slot preset beats avg and reads ctx.settings.presets', () => {
    const ctx = makeCtx();
    const m = matchup({ offenseLineupId: 'lo' });
    expect(resolveStats(m, 'offense', 'Y', ctx)).toEqual(DEFAULT_PRESETS.weak);
    ctx.settings.presets.weak.speed = 5.5;
    expect(resolveStats(m, 'offense', 'Y', ctx).speed).toBe(5.5);
  });

  it('level 3: lineup athlete beats the slot preset', () => {
    const m = matchup({ offenseLineupId: 'lo' });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual(athleteStats);
  });

  it('level 2: override.preset beats lineup athlete', () => {
    const m = matchup({
      offenseLineupId: 'lo',
      overrides: [{ side: 'offense', label: 'X', preset: 'weak' }],
    });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual(DEFAULT_PRESETS.weak);
  });

  it('level 1: override.stats beats override.preset', () => {
    const m = matchup({
      offenseLineupId: 'lo',
      overrides: [{ side: 'offense', label: 'X', preset: 'weak', stats: { speed: 10 } }],
    });
    const r = resolveStats(m, 'offense', 'X', makeCtx());
    expect(r.speed).toBe(10);
    expect(r.accel).toBe(DEFAULT_PRESETS.weak.accel);
  });

  it('override.stats is partial: other keys come from the lower level (athlete)', () => {
    const m = matchup({
      offenseLineupId: 'lo',
      overrides: [{ side: 'offense', label: 'X', stats: { iq: 0.1 } }],
    });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual({ ...athleteStats, iq: 0.1 });
  });

  it('override.stats alone sits on top of avg', () => {
    const m = matchup({ overrides: [{ side: 'offense', label: 'X', stats: { speed: 9 } }] });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual({ ...DEFAULT_PRESETS.avg, speed: 9 });
  });

  it('undefined values in override.stats are skipped', () => {
    const m = matchup({ overrides: [{ side: 'offense', label: 'X', stats: { speed: undefined } }] });
    expect(resolveStats(m, 'offense', 'X', makeCtx()).speed).toBe(DEFAULT_PRESETS.avg.speed);
  });

  it('override for the other side is ignored', () => {
    const m = matchup({
      offenseLineupId: 'lo',
      overrides: [{ side: 'defense', label: 'X', preset: 'weak', stats: { speed: 1 } }],
    });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual(athleteStats);
  });

  it('override for a different label is ignored', () => {
    const m = matchup({ overrides: [{ side: 'offense', label: 'Y', preset: 'good' }] });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual(DEFAULT_PRESETS.avg);
  });

  it('uses the lineup of the requested side', () => {
    const m = matchup({ offenseLineupId: 'lo', defenseLineupId: 'ld' });
    expect(resolveStats(m, 'defense', 'X', makeCtx())).toEqual(DEFAULT_PRESETS.good);
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual(athleteStats);
  });

  it('missing lineup id falls through to avg', () => {
    const m = matchup({ offenseLineupId: 'nope' });
    expect(resolveStats(m, 'offense', 'X', makeCtx())).toEqual(DEFAULT_PRESETS.avg);
  });

  it('slot label not in lineup falls through to avg', () => {
    const m = matchup({ offenseLineupId: 'lo' });
    expect(resolveStats(m, 'offense', 'Q', makeCtx())).toEqual(DEFAULT_PRESETS.avg);
  });

  it('missing athlete falls through to the slot preset', () => {
    const m = matchup({ offenseLineupId: 'lo' });
    expect(resolveStats(m, 'offense', 'Z', makeCtx())).toEqual(DEFAULT_PRESETS.good);
  });

  it('returns a fresh object, never a reference into ctx', () => {
    const ctx = makeCtx();
    const viaAvg = resolveStats(matchup(), 'offense', 'X', ctx);
    expect(viaAvg).not.toBe(ctx.settings.presets.avg);
    viaAvg.speed = 99;
    expect(ctx.settings.presets.avg.speed).toBe(DEFAULT_PRESETS.avg.speed);

    const viaAthlete = resolveStats(matchup({ offenseLineupId: 'lo' }), 'offense', 'X', ctx);
    expect(viaAthlete).not.toBe(ctx.athletes.a1?.stats);
    viaAthlete.speed = 99;
    expect(ctx.athletes.a1?.stats.speed).toBe(9.5);
  });
});

describe('readTime (§7.1)', () => {
  it('maps iq to read time', () => {
    expect(readTime(0.3)).toBeCloseTo(0.65, 9);
    expect(readTime(0.5)).toBeCloseTo(0.55, 9);
    expect(readTime(0.8)).toBeCloseTo(0.4, 9);
  });
});

describe('classifyStats', () => {
  it('returns the preset id for each preset', () => {
    const presets = createDefaultSettings().presets;
    expect(classifyStats({ ...presets.weak }, presets)).toBe('weak');
    expect(classifyStats({ ...presets.avg }, presets)).toBe('avg');
    expect(classifyStats({ ...presets.good }, presets)).toBe('good');
  });

  it('tolerates differences below 1e-6', () => {
    const presets = createDefaultSettings().presets;
    expect(classifyStats({ ...presets.avg, speed: presets.avg.speed + 1e-8 }, presets)).toBe('avg');
  });

  it('returns custom when one stat differs', () => {
    const presets = createDefaultSettings().presets;
    expect(classifyStats({ ...presets.avg, hands: 0.76 }, presets)).toBe('custom');
    expect(classifyStats({ ...presets.good, armRange: 41 }, presets)).toBe('custom');
  });

  it('compares against the given (edited) presets, not the defaults', () => {
    const presets = createDefaultSettings().presets;
    presets.avg.speed = 7.5;
    expect(classifyStats({ ...DEFAULT_PRESETS.avg }, presets)).toBe('custom');
    expect(classifyStats({ ...presets.avg }, presets)).toBe('avg');
  });
});
