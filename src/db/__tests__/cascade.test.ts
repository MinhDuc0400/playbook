import { beforeEach, describe, expect, it } from 'vitest';
import {
  PlayInUseError,
  deleteMatchup,
  deletePlay,
  getPlayDeleteImpact,
  installsRepo,
  matchupsRepo,
  playsRepo,
} from '../repos';
import { resetDb } from '../schema';
import { makeInstall, makeMatchup, makePlay } from './fixtures';

/**
 * Data set:
 *  plays: o1, o2 (offense), d1, d2 (defense), lonely
 *  matchups: m1 (o1,d1)  m2 (o1,d2)  m3 (o2,d1)  m4 (o2,d2)
 *  installs: iA = [m1, m3, m2, m4] ; iB = [m4] ; iC = [m2, m1]
 */
async function seed() {
  await playsRepo.bulkPut(
    ['o1', 'o2', 'd1', 'd2', 'lonely'].map((id) =>
      makePlay(id, { side: id.startsWith('d') ? 'defense' : 'offense' }),
    ),
  );
  await matchupsRepo.bulkPut([
    makeMatchup('m1', 'o1', 'd1'),
    makeMatchup('m2', 'o1', 'd2'),
    makeMatchup('m3', 'o2', 'd1'),
    makeMatchup('m4', 'o2', 'd2'),
  ]);
  await installsRepo.bulkPut([
    makeInstall('iA', ['m1', 'm3', 'm2', 'm4']),
    makeInstall('iB', ['m4']),
    makeInstall('iC', ['m2', 'm1']),
  ]);
}

async function dump() {
  return {
    plays: (await playsRepo.list()).map((p) => p.id).sort(),
    matchups: (await matchupsRepo.list()).map((m) => m.id).sort(),
    installs: await installsRepo.list(),
  };
}

beforeEach(async () => {
  await resetDb();
  await seed();
});

describe('FR-DAT-02 getPlayDeleteImpact', () => {
  it('lists affected matchups and install items', async () => {
    const impact = await getPlayDeleteImpact('o1');
    expect(impact.matchups.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    const byInstall = Object.fromEntries(impact.installs.map((x) => [x.install.id, x.itemIds.sort()]));
    expect(byInstall).toEqual({ iA: ['iA-i0', 'iA-i2'], iC: ['iC-i0', 'iC-i1'] });
  });

  it('works for a defense play', async () => {
    const impact = await getPlayDeleteImpact('d2');
    expect(impact.matchups.map((m) => m.id).sort()).toEqual(['m2', 'm4']);
    expect(impact.installs.map((x) => x.install.id).sort()).toEqual(['iA', 'iB', 'iC']);
  });

  it('is empty for an unused play and does not write', async () => {
    const before = await dump();
    expect(await getPlayDeleteImpact('lonely')).toEqual({ matchups: [], installs: [] });
    expect(await dump()).toEqual(before);
  });
});

describe('FR-DAT-02 deletePlay', () => {
  it('unused play: deletes without cascade', async () => {
    await deletePlay('lonely', { cascade: false });
    expect(await playsRepo.get('lonely')).toBeUndefined();
    expect((await matchupsRepo.list()).length).toBe(4);
  });

  it('cascade:false with dependents throws PlayInUseError carrying the impact and writes nothing', async () => {
    const before = await dump();
    const err = await deletePlay('o1', { cascade: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PlayInUseError);
    const impact = (err as PlayInUseError).impact;
    expect(impact.matchups.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    expect(impact.installs.map((x) => x.install.id).sort()).toEqual(['iA', 'iC']);
    expect(await dump()).toEqual(before);
  });

  it('cascade:true removes play, matchups and install items with orders re-packed; unrelated data untouched', async () => {
    const iBBefore = await installsRepo.get('iB');
    const t = Date.now();
    await deletePlay('o1', { cascade: true });

    expect(await playsRepo.get('o1')).toBeUndefined();
    expect((await playsRepo.list()).map((p) => p.id).sort()).toEqual(['d1', 'd2', 'lonely', 'o2']);
    expect((await matchupsRepo.list()).map((m) => m.id).sort()).toEqual(['m3', 'm4']);

    const iA = await installsRepo.get('iA');
    expect(iA?.items.map((i) => [i.matchupId, i.order])).toEqual([
      ['m3', 0],
      ['m4', 1],
    ]);
    expect(iA?.updatedAt).toBeGreaterThanOrEqual(t);
    const iC = await installsRepo.get('iC');
    expect(iC?.items).toEqual([]);
    expect(iC?.updatedAt).toBeGreaterThanOrEqual(t);
    // install not referencing the removed matchups is byte-for-byte unchanged
    expect(await installsRepo.get('iB')).toEqual(iBBefore);
  });

  it('re-packs order sorted by old order even when items are stored out of order and orders have gaps', async () => {
    await installsRepo.put({
      ...makeInstall('iG', []),
      items: [
        { id: 'x3', matchupId: 'm4', order: 7 },
        { id: 'x1', matchupId: 'm1', order: 2 },
        { id: 'x2', matchupId: 'm3', order: 5 },
        { id: 'x0', matchupId: 'm2', order: 0 },
      ],
    });
    await deletePlay('d1', { cascade: true }); // removes m1, m3
    const g = await installsRepo.get('iG');
    expect(g?.items.map((i) => [i.id, i.order])).toEqual([
      ['x0', 0],
      ['x3', 1],
    ]);
  });

  it('a matchup using the same play on both sides is handled once', async () => {
    await matchupsRepo.put(makeMatchup('m5', 'lonely', 'lonely'));
    expect((await getPlayDeleteImpact('lonely')).matchups.map((m) => m.id)).toEqual(['m5']);
    await deletePlay('lonely', { cascade: true });
    expect(await matchupsRepo.get('m5')).toBeUndefined();
  });
});

describe('deleteMatchup', () => {
  it('removes the matchup and its install items, re-packing orders', async () => {
    await deleteMatchup('m3');
    expect(await matchupsRepo.get('m3')).toBeUndefined();
    const iA = await installsRepo.get('iA');
    expect(iA?.items.map((i) => [i.matchupId, i.order])).toEqual([
      ['m1', 0],
      ['m2', 1],
      ['m4', 2],
    ]);
    expect((await installsRepo.get('iB'))?.items).toHaveLength(1);
    expect((await matchupsRepo.list()).length).toBe(3);
    expect((await playsRepo.list()).length).toBe(5);
  });

  it('unknown matchup is a no-op', async () => {
    const before = await dump();
    await deleteMatchup('nope');
    expect(await dump()).toEqual(before);
  });
});
