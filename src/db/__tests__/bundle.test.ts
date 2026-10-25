import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import {
  athletesRepo,
  lineupsRepo,
  loadDbSnapshot,
  loadMatchupBundle,
  matchupsRepo,
  playsRepo,
  settingsRepo,
} from '../repos';
import { resetDb } from '../schema';
import { makeAthlete, makeLineup, makeMatchup, makePlay } from './fixtures';

beforeEach(async () => {
  await resetDb();
});

describe('loadMatchupBundle (FR-DAT-03)', () => {
  const off = makePlay('o1');
  const def = makePlay('d1', { side: 'defense' });
  const mu = makeMatchup('m1', 'o1', 'd1');

  it('ok when both plays exist', async () => {
    await playsRepo.bulkPut([off, def]);
    await matchupsRepo.put(mu);
    expect(await loadMatchupBundle('m1')).toEqual({ status: 'ok', matchup: mu, offense: off, defense: def });
  });

  it('missing-matchup for an unknown id', async () => {
    expect(await loadMatchupBundle('nope')).toEqual({ status: 'missing-matchup' });
  });

  it('missing-play: offense', async () => {
    await playsRepo.put(def);
    await matchupsRepo.put(mu);
    expect(await loadMatchupBundle('m1')).toEqual({
      status: 'missing-play',
      matchup: mu,
      missing: ['offense'],
      defense: def,
    });
  });

  it('missing-play: defense', async () => {
    await playsRepo.put(off);
    await matchupsRepo.put(mu);
    expect(await loadMatchupBundle('m1')).toEqual({
      status: 'missing-play',
      matchup: mu,
      missing: ['defense'],
      offense: off,
    });
  });

  it('missing-play: both', async () => {
    await matchupsRepo.put(mu);
    expect(await loadMatchupBundle('m1')).toEqual({
      status: 'missing-play',
      matchup: mu,
      missing: ['offense', 'defense'],
    });
  });
});

describe('loadDbSnapshot', () => {
  it('uses default settings and empty maps on an empty DB', async () => {
    expect(await loadDbSnapshot()).toEqual({ settings: createDefaultSettings(), lineups: {}, athletes: {} });
  });

  it('returns stored settings and lineups/athletes keyed by id', async () => {
    const settings = { ...createDefaultSettings(), defaultFormat: '7v7' as const };
    const a1 = makeAthlete('a1');
    const a2 = makeAthlete('a2');
    const l1 = makeLineup('l1');
    await settingsRepo.put(settings);
    await athletesRepo.bulkPut([a1, a2]);
    await lineupsRepo.put(l1);
    expect(await loadDbSnapshot()).toEqual({ settings, lineups: { l1 }, athletes: { a1, a2 } });
  });
});
