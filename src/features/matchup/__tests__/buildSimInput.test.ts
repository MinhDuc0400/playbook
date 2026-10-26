import { describe, expect, it } from 'vitest';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { createDefaultSettings } from '@/domain/defaults';
import { DEFAULT_BALL_SPOT } from '@/domain/field';
import { flipPlay } from '@/domain/flip';
import { SCHEMA_VERSION, type DbSnapshot, type Matchup } from '@/domain/types';
import { buildSimInput, createMatchup, levelOf, randomSeed, setOverridePreset } from '../buildSimInput';

const plays = createSamplePlays(1);
const mesh = plays.find((p) => p.id === SEED_IDS.mesh)!;
const cover1 = plays.find((p) => p.id === SEED_IDS.cover1)!;
const ctx: DbSnapshot = { settings: createDefaultSettings(), lineups: {}, athletes: {} };

function mk(over: Partial<Matchup> = {}): Matchup {
  return {
    ...createMatchup({ offensePlayId: mesh.id, defensePlayId: cover1.id, now: 5, idGen: () => 'm1' }),
    ...over,
  };
}

describe('buildSimInput', () => {
  it('auto-flips the defense and resolves stats per slot id', () => {
    const before = JSON.stringify([mesh, cover1]);
    const m = mk({ seed: 42, anticipation: 0.8, noise: true, ballSpot: { x: 3, yardLine: 30 } });
    const built = buildSimInput(m, mesh, cover1, ctx);
    expect(built.defenseFlipped).toBe(true);
    expect(built.defense).toEqual(flipPlay(cover1));
    expect(built.offense).toEqual(mesh);
    const { avg } = ctx.settings.presets;
    for (const s of cover1.players) expect(built.input.defenseStats[s.id]).toEqual(avg);
    for (const s of mesh.players) expect(built.input.offenseStats[s.id]).toEqual(avg);
    expect(built.input.field).toBe(ctx.settings.fields['5v5']);
    expect(built.input.tuning).toBe(ctx.settings.tuning);
    expect(built.input.routePriors).toBe(ctx.settings.routePriors);
    expect(built.input.seed).toBe(42);
    expect(built.input.anticipation).toBe(0.8);
    expect(built.input.noise).toBe(true);
    expect(built.input.ballSpot).toEqual({ x: 3, yardLine: 30 });
    expect(JSON.stringify([mesh, cover1])).toBe(before);
  });

  it('applies a weak override to the matching defender slot only', () => {
    const m = setOverridePreset(mk(), 'defense', 'CB1', 'weak');
    const built = buildSimInput(m, mesh, cover1, ctx);
    const cb1 = cover1.players.find((p) => p.label === 'CB1')!;
    const cb2 = cover1.players.find((p) => p.label === 'CB2')!;
    expect(built.input.defenseStats[cb1.id]).toEqual(ctx.settings.presets.weak);
    expect(built.input.defenseStats[cb2.id]).toEqual(ctx.settings.presets.avg);
  });

  it("respects defenseFlip 'none'", () => {
    const built = buildSimInput(mk({ defenseFlip: 'none' }), mesh, cover1, ctx);
    expect(built.defenseFlipped).toBe(false);
    expect(built.defense).toEqual(cover1);
  });
});

describe('createMatchup / setOverridePreset / levelOf / randomSeed', () => {
  it('creates defaults', () => {
    const m = createMatchup({ offensePlayId: 'o', defensePlayId: 'd', now: 9, idGen: () => 'id' });
    expect(m).toMatchObject({
      id: 'id',
      schemaVersion: SCHEMA_VERSION,
      offensePlayId: 'o',
      defensePlayId: 'd',
      offenseFlipped: false,
      defenseFlip: 'auto',
      overrides: [],
      anticipation: 0.5,
      ballSpot: DEFAULT_BALL_SPOT,
      seed: 1,
      noise: false,
      createdAt: 9,
      updatedAt: 9,
    });
    expect(
      createMatchup({ offensePlayId: 'o', defensePlayId: 'd', now: 9, idGen: () => 'x', seed: 7 }).seed,
    ).toBe(7);
  });

  it('adds then replaces an override preset, keeping stats', () => {
    const m0 = mk();
    const m1 = setOverridePreset(m0, 'offense', 'X', 'good');
    expect(m0.overrides).toEqual([]);
    expect(m1.overrides).toEqual([{ side: 'offense', label: 'X', preset: 'good' }]);
    const withStats: Matchup = {
      ...m1,
      overrides: [{ side: 'offense', label: 'X', preset: 'good', stats: { speed: 9 } }],
    };
    const m2 = setOverridePreset(withStats, 'offense', 'X', 'weak');
    expect(m2.overrides).toEqual([{ side: 'offense', label: 'X', preset: 'weak', stats: { speed: 9 } }]);
    const m3 = setOverridePreset(m2, 'defense', 'X', 'good');
    expect(m3.overrides).toHaveLength(2);
  });

  it('levelOf classifies presets and custom', () => {
    const { weak, avg, good } = ctx.settings.presets;
    expect(levelOf(weak, ctx)).toBe('weak');
    expect(levelOf(avg, ctx)).toBe('avg');
    expect(levelOf(good, ctx)).toBe('good');
    expect(levelOf({ ...avg, speed: avg.speed + 1 }, ctx)).toBe('custom');
  });

  it('randomSeed is an int in [0, 2^31)', () => {
    for (let i = 0; i < 20; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 31);
    }
  });
});
