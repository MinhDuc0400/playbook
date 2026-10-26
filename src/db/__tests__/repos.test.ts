import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import {
  athletesRepo,
  installsRepo,
  lineupsRepo,
  matchupsRepo,
  playsRepo,
  settingsRepo,
  type Repo,
} from '../repos';
import { resetDb } from '../schema';
import { makeAthlete, makeInstall, makeLineup, makeMatchup, makePlay } from './fixtures';

beforeEach(async () => {
  await resetDb();
});

function crudSuite<T extends { id: string }>(
  name: string,
  repo: Repo<T>,
  make: (id: string) => T,
  edit: (r: T) => T,
) {
  describe(`${name} CRUD`, () => {
    it('put / get / count / list', async () => {
      expect(await repo.get('x')).toBeUndefined();
      expect(await repo.count()).toBe(0);
      await repo.put(make('x'));
      expect(await repo.get('x')).toEqual(make('x'));
      expect(await repo.count()).toBe(1);
      expect(await repo.list()).toEqual([make('x')]);
    });

    it('put overwrites by id', async () => {
      await repo.put(make('x'));
      await repo.put(edit(make('x')));
      expect(await repo.count()).toBe(1);
      expect(await repo.get('x')).toEqual(edit(make('x')));
    });

    it('bulkPut / getMany keeps order and returns undefined for unknown ids', async () => {
      await repo.bulkPut([make('a'), make('b'), make('c')]);
      expect(await repo.count()).toBe(3);
      expect(await repo.getMany(['c', 'zzz', 'a'])).toEqual([make('c'), undefined, make('a')]);
    });

    it('remove deletes one record and ignores unknown ids', async () => {
      await repo.bulkPut([make('a'), make('b')]);
      await repo.remove('a');
      await repo.remove('nope');
      expect((await repo.list()).map((r) => r.id)).toEqual(['b']);
    });
  });
}

crudSuite(
  'playsRepo',
  playsRepo,
  (id) => makePlay(id),
  (p) => ({ ...p, name: 'Renamed', updatedAt: p.updatedAt + 1 }),
);
crudSuite(
  'athletesRepo',
  athletesRepo,
  (id) => makeAthlete(id),
  (a) => ({ ...a, name: 'Renamed' }),
);
crudSuite(
  'lineupsRepo',
  lineupsRepo,
  (id) => makeLineup(id),
  (l) => ({ ...l, name: 'Renamed' }),
);
crudSuite(
  'matchupsRepo',
  matchupsRepo,
  (id) => makeMatchup(id, 'o', 'd'),
  (m) => ({ ...m, seed: 99 }),
);
crudSuite(
  'installsRepo',
  installsRepo,
  (id) => makeInstall(id, ['m']),
  (i) => ({ ...i, name: 'Renamed' }),
);

describe('playsRepo queries', () => {
  it('listBySide', async () => {
    await playsRepo.bulkPut([
      makePlay('o1', { side: 'offense' }),
      makePlay('d1', { side: 'defense' }),
      makePlay('o2', { side: 'offense' }),
    ]);
    expect((await playsRepo.listBySide('offense')).map((p) => p.id).sort()).toEqual(['o1', 'o2']);
    expect((await playsRepo.listBySide('defense')).map((p) => p.id)).toEqual(['d1']);
  });

  it('listByTag uses the multiEntry tags index and returns only matching plays', async () => {
    await playsRepo.bulkPut([
      makePlay('p1', { tags: ['red zone', 'quick'] }),
      makePlay('p2', { tags: ['quick'] }),
      makePlay('p3', { tags: ['deep'] }),
      makePlay('p4', { tags: [] }),
    ]);
    expect((await playsRepo.listByTag('quick')).map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    expect((await playsRepo.listByTag('deep')).map((p) => p.id)).toEqual(['p3']);
    expect(await playsRepo.listByTag('missing')).toEqual([]);
  });

  it('allTags returns distinct sorted tags', async () => {
    expect(await playsRepo.allTags()).toEqual([]);
    await playsRepo.bulkPut([
      makePlay('p1', { tags: ['quick', 'red zone'] }),
      makePlay('p2', { tags: ['deep', 'quick'] }),
      makePlay('p3', { tags: [] }),
    ]);
    expect(await playsRepo.allTags()).toEqual(['deep', 'quick', 'red zone']);
  });

  it('duplicate makes a saved copy with new id, suffixed name, fresh timestamps and the same slot ids', async () => {
    const src = makePlay('p1', { name: 'Mesh', tags: ['quick'], createdAt: 1, updatedAt: 2 });
    await playsRepo.put(src);
    const before = Date.now();
    const copy = await playsRepo.duplicate('p1');
    expect(copy.id).not.toBe('p1');
    expect(copy.name).toBe('Mesh (bản sao)');
    expect(copy.createdAt).toBeGreaterThanOrEqual(before);
    expect(copy.updatedAt).toBe(copy.createdAt);
    expect(copy.players.map((s) => s.id)).toEqual(src.players.map((s) => s.id));
    expect(copy.tags).toEqual(['quick']);
    expect(await playsRepo.get(copy.id)).toEqual(copy);
    expect(await playsRepo.get('p1')).toEqual(src);
    // deep copy: editing the duplicate's slots does not alias the source
    expect(copy.players).not.toBe(src.players);
  });

  it('duplicate of an unknown play rejects', async () => {
    await expect(playsRepo.duplicate('nope')).rejects.toThrow();
  });
});

describe('lineupsRepo.listFor', () => {
  it('filters by side and format', async () => {
    await lineupsRepo.bulkPut([
      makeLineup('a', { side: 'offense', format: '5v5' }),
      makeLineup('b', { side: 'offense', format: '7v7' }),
      makeLineup('c', { side: 'defense', format: '5v5' }),
      makeLineup('d', { side: 'offense', format: '5v5' }),
    ]);
    expect((await lineupsRepo.listFor('offense', '5v5')).map((l) => l.id).sort()).toEqual(['a', 'd']);
    expect((await lineupsRepo.listFor('defense', '5v5')).map((l) => l.id)).toEqual(['c']);
    expect(await lineupsRepo.listFor('defense', '7v7')).toEqual([]);
  });
});

describe('matchupsRepo queries', () => {
  beforeEach(async () => {
    await matchupsRepo.bulkPut([
      makeMatchup('m1', 'o1', 'd1'),
      makeMatchup('m2', 'o1', 'd2'),
      makeMatchup('m3', 'o2', 'd1'),
    ]);
  });

  it('listByPlay matches offense or defense play', async () => {
    expect((await matchupsRepo.listByPlay('o1')).map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    expect((await matchupsRepo.listByPlay('d1')).map((m) => m.id).sort()).toEqual(['m1', 'm3']);
    expect(await matchupsRepo.listByPlay('zzz')).toEqual([]);
  });

  it('listByPlay does not duplicate a matchup that uses the same play on both sides', async () => {
    await matchupsRepo.put(makeMatchup('m4', 'same', 'same'));
    expect((await matchupsRepo.listByPlay('same')).map((m) => m.id)).toEqual(['m4']);
  });

  it('countByPlay counts both sides', async () => {
    expect(await matchupsRepo.countByPlay()).toEqual({ o1: 2, o2: 1, d1: 2, d2: 1 });
  });
});

describe('installsRepo.listByMatchup', () => {
  it('returns installs containing the matchup', async () => {
    await installsRepo.bulkPut([
      makeInstall('i1', ['m1', 'm2']),
      makeInstall('i2', ['m2']),
      makeInstall('i3', []),
    ]);
    expect((await installsRepo.listByMatchup('m2')).map((i) => i.id).sort()).toEqual(['i1', 'i2']);
    expect((await installsRepo.listByMatchup('m1')).map((i) => i.id)).toEqual(['i1']);
    expect(await installsRepo.listByMatchup('none')).toEqual([]);
  });
});

describe('settingsRepo', () => {
  it('get is undefined and getOrDefault returns defaults without writing', async () => {
    expect(await settingsRepo.get()).toBeUndefined();
    expect(await settingsRepo.getOrDefault()).toEqual(createDefaultSettings());
    expect(await settingsRepo.get()).toBeUndefined();
  });

  it('put then get / getOrDefault', async () => {
    const s = { ...createDefaultSettings(), defaultFormat: '7v7' as const };
    await settingsRepo.put(s);
    expect(await settingsRepo.get()).toEqual(s);
    expect(await settingsRepo.getOrDefault()).toEqual(s);
  });

  it('update shallow-merges onto defaults when nothing is stored, and persists', async () => {
    const res = await settingsRepo.update({ defaultFormat: '7v7' });
    expect(res).toEqual({ ...createDefaultSettings(), defaultFormat: '7v7' });
    expect(await settingsRepo.get()).toEqual(res);
  });

  it('update merges shallowly onto stored settings (replaces top-level keys)', async () => {
    await settingsRepo.put({ ...createDefaultSettings(), lastExportAt: 5 });
    const res = await settingsRepo.update({ ui: { theme: 'dark', snap: false, showGrid: true } });
    expect(res.ui).toEqual({ theme: 'dark', snap: false, showGrid: true });
    expect(res.lastExportAt).toBe(5);
    expect(res.key).toBe('app');
  });
});

describe('settingsRepo fills keys missing from older records (D-22)', () => {
  it('get/getOrDefault/update return complete tuning', async () => {
    const { createDefaultSettings, DEFAULT_TUNING } = await import('@/domain/defaults');
    const { getDb } = await import('../schema');
    const s = createDefaultSettings();
    const tuning: Record<string, number> = { ...s.tuning };
    delete tuning.scoreThrow;
    await getDb().settings.put({ ...s, tuning: tuning as unknown as typeof s.tuning });
    const { settingsRepo } = await import('../repos/settings');
    expect((await settingsRepo.get())?.tuning.scoreThrow).toBe(DEFAULT_TUNING.scoreThrow);
    expect((await settingsRepo.getOrDefault()).tuning.scoreThrow).toBe(DEFAULT_TUNING.scoreThrow);
    expect((await settingsRepo.update({ defaultFormat: '7v7' })).tuning.scoreThrow).toBe(
      DEFAULT_TUNING.scoreThrow,
    );
  });
});
