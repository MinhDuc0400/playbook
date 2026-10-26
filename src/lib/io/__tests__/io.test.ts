import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeAthlete,
  makeInstall,
  makeLineup,
  makeMatchup,
  makePlay,
  makeSettings,
} from '@/db/__tests__/fixtures';
import { athletesRepo, installsRepo, lineupsRepo, matchupsRepo, playsRepo, settingsRepo } from '@/db/repos';
import { getDb, resetDb } from '@/db/schema';
import { createSamplePlays } from '@/db/seed/samplePlays';
import { SCHEMA_VERSION, type ExportFile } from '@/domain/types';
import { exportAll, serializeExport } from '../exportData';
import { importData, parseImport } from '../importData';

async function populate(): Promise<void> {
  await playsRepo.bulkPut(createSamplePlays(1_700_000_000_000));
  await athletesRepo.put(makeAthlete('a1'));
  await lineupsRepo.put(makeLineup('l1', { slots: [{ label: 'X', athleteId: 'a1' }] }));
  await matchupsRepo.put(makeMatchup('m1', 'seed-off-mesh', 'seed-def-cover-3', { offenseLineupId: 'l1' }));
  await installsRepo.put(makeInstall('i1', ['m1']));
  await settingsRepo.put(makeSettings());
}

async function snapshot(): Promise<string> {
  return JSON.stringify(await exportAll(new Date(0)));
}

beforeEach(async () => {
  await resetDb();
});

describe('FR-IO-01 export', () => {
  it('round trips every table through serialize + parse', async () => {
    await populate();
    const file = await exportAll(new Date('2026-01-02T03:04:05Z'));
    const { json, fileName } = serializeExport(file);
    expect(fileName).toBe('flagbook-2026-01-02.json');
    const parsed = parseImport(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.file).toEqual(file);
    expect(file.data.plays?.length).toBe(6);
  });
});

describe('FR-IO-02 validation', () => {
  it('rejects bad JSON, wrong app, newer version, invalid play; writes nothing', async () => {
    await populate();
    const before = await snapshot();
    const good = await exportAll();
    const badPlay = structuredClone(good) as unknown as { data: { plays: Record<string, unknown>[] } };
    delete badPlay.data.plays[0]!.players;
    const cases = [
      'not json',
      JSON.stringify({ ...good, app: 'other' }),
      JSON.stringify({ ...good, schemaVersion: SCHEMA_VERSION + 1 }),
      JSON.stringify(badPlay),
    ];
    for (const text of cases) {
      const r = parseImport(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    }
    const r = parseImport(cases[3]!);
    if (!r.ok) expect(r.errors[0]).toMatch(/data\.plays\[0\]\.players/);
    expect(await snapshot()).toBe(before);
  });

  it('migrates an old file without schemaVersion on records', async () => {
    const play = makePlay('old') as unknown as Record<string, unknown>;
    delete play.schemaVersion;
    const ath = makeAthlete('oa') as unknown as Record<string, unknown>;
    delete ath.schemaVersion;
    delete ath.createdAt;
    delete ath.updatedAt;
    const text = JSON.stringify({
      app: 'flagbook',
      schemaVersion: 0,
      exportedAt: '2020-01-01T00:00:00Z',
      data: { plays: [play], athletes: [ath] },
    });
    const parsed = parseImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.data.plays?.[0]?.schemaVersion).toBe(SCHEMA_VERSION);
    const report = await importData(parsed.file, 'merge');
    expect(report.plays.added).toBe(1);
    expect(report.athletes.added).toBe(1);
    expect((await athletesRepo.get('oa'))?.updatedAt).toBeTypeOf('number');
  });
});

function fileOf(data: ExportFile['data']): ExportFile {
  return { app: 'flagbook', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

describe('FR-IO-03 import modes', () => {
  it('merge newer: updates newer, skips older, adds new', async () => {
    await playsRepo.bulkPut([
      makePlay('p-old', { updatedAt: 100, name: 'stored-old' }),
      makePlay('p-new', { updatedAt: 500, name: 'stored-new' }),
    ]);
    const report = await importData(
      fileOf({
        plays: [
          makePlay('p-old', { updatedAt: 200, name: 'incoming' }),
          makePlay('p-new', { updatedAt: 400, name: 'incoming' }),
          makePlay('p-add', { updatedAt: 1 }),
        ],
      }),
      'merge',
      'newer',
    );
    expect(report.plays).toEqual({ added: 1, updated: 1, skipped: 1 });
    expect((await playsRepo.get('p-old'))?.name).toBe('incoming');
    expect((await playsRepo.get('p-new'))?.name).toBe('stored-new');
    expect(await playsRepo.count()).toBe(3);
  });

  it('merge copy: conflicting play gets a new id and the matchup reference is remapped', async () => {
    await playsRepo.put(makePlay('p1', { name: 'stored' }));
    const report = await importData(
      fileOf({
        plays: [makePlay('p1', { name: 'incoming' }), makePlay('p2')],
        matchups: [makeMatchup('m1', 'p1', 'p2')],
        installs: [makeInstall('i1', ['m1'])],
      }),
      'merge',
      'copy',
    );
    expect(report.plays.added).toBe(2);
    expect((await playsRepo.get('p1'))?.name).toBe('stored');
    const plays = await playsRepo.list();
    expect(plays).toHaveLength(3);
    const copy = plays.find((p) => p.name === 'incoming')!;
    expect(copy.id).not.toBe('p1');
    const m = (await matchupsRepo.list())[0]!;
    expect(m.offensePlayId).toBe(copy.id);
    expect(m.defensePlayId).toBe('p2');
  });

  it('merge copy: remaps install items when the matchup id conflicts', async () => {
    await matchupsRepo.put(makeMatchup('m1', 'x', 'y'));
    await importData(
      fileOf({
        plays: [makePlay('p1'), makePlay('p2')],
        matchups: [makeMatchup('m1', 'p1', 'p2')],
        installs: [makeInstall('i1', ['m1'])],
      }),
      'merge',
      'copy',
    );
    const newMatchup = (await matchupsRepo.list()).find((m) => m.offensePlayId === 'p1')!;
    expect(newMatchup.id).not.toBe('m1');
    expect((await installsRepo.get('i1'))?.items[0]?.matchupId).toBe(newMatchup.id);
  });

  it('replace: DB holds exactly the file records', async () => {
    await populate();
    const report = await importData(fileOf({ plays: [makePlay('only')] }), 'replace');
    expect(report.plays.added).toBe(1);
    expect((await playsRepo.list()).map((p) => p.id)).toEqual(['only']);
    expect(await athletesRepo.count()).toBe(0);
    expect(await matchupsRepo.count()).toBe(0);
    expect(await installsRepo.count()).toBe(0);
    expect(await settingsRepo.get()).toBeDefined();
  });

  it('settings: file settings win in merge and count as updated', async () => {
    await settingsRepo.put(makeSettings());
    const next = makeSettings({ defaultFormat: '7v7' });
    const report = await importData(fileOf({ settings: next }), 'merge');
    expect(report.settings.updated).toBe(1);
    expect((await settingsRepo.get())?.defaultFormat).toBe('7v7');
  });

  it('atomic: an exception mid-transaction leaves the DB unchanged', async () => {
    await populate();
    const before = await snapshot();
    const spy = vi.spyOn(getDb().matchups, 'bulkAdd').mockRejectedValue(new Error('boom'));
    await expect(
      importData(
        fileOf({ plays: [makePlay('new')], matchups: [makeMatchup('mx', 'new', 'new')] }),
        'replace',
      ),
    ).rejects.toThrow();
    spy.mockRestore();
    expect(await snapshot()).toBe(before);
  });
});
