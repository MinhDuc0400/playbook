import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@/domain/types';
import { migrateRecord } from '../migrations';
import { FlagDB, STORES_V1 } from '../schema';
import { makeAthlete, makeInstall, makeLineup, makeMatchup, makePlay } from './fixtures';

let counter = 0;
const opened: Dexie[] = [];
const names: string[] = [];

function uniqueName(): string {
  const n = `flagbook-mig-${Date.now()}-${counter++}`;
  names.push(n);
  return n;
}

afterEach(async () => {
  opened.splice(0).forEach((d) => d.close());
  await Promise.all(names.splice(0).map((n) => Dexie.delete(n)));
});

type Loose = Record<string, unknown>;

function stripped(rec: object, ...keys: string[]): Loose {
  const copy: Loose = { ...(rec as Loose) };
  for (const k of keys) delete copy[k];
  return copy;
}

describe('FR-DAT-01 Dexie v1 → v2 upgrade', () => {
  it('keeps all data, backfills schemaVersion and athlete/lineup timestamps', async () => {
    const name = uniqueName();
    const v1 = new Dexie(name);
    v1.version(1).stores(STORES_V1);
    const play = makePlay('p1', { tags: ['red zone', 'quick'] });
    const matchup = makeMatchup('m1', 'p1', 'p2');
    const install = makeInstall('i1', ['m1']);
    const athlete = makeAthlete('a1');
    const lineup = makeLineup('l1');
    await v1.table('plays').put(stripped(play, 'schemaVersion'));
    await v1.table('matchups').put(stripped(matchup, 'schemaVersion'));
    await v1.table('installs').put(stripped(install, 'schemaVersion'));
    await v1.table('athletes').put(stripped(athlete, 'schemaVersion', 'createdAt', 'updatedAt'));
    await v1.table('lineups').put(stripped(lineup, 'schemaVersion', 'createdAt', 'updatedAt'));
    await v1.table('settings').put({ key: 'app', ui: { theme: 'dark' } });
    v1.close();

    const before = Date.now();
    const db = new FlagDB(name);
    opened.push(db);
    await db.open();
    const after = Date.now();

    expect(await db.plays.get('p1')).toEqual({ ...play, schemaVersion: 1 });
    expect(await db.matchups.get('m1')).toEqual({ ...matchup, schemaVersion: 1 });
    expect(await db.installs.get('i1')).toEqual({ ...install, schemaVersion: 1 });

    const a = await db.athletes.get('a1');
    expect(a).toMatchObject({
      ...stripped(athlete, 'createdAt', 'updatedAt'),
      schemaVersion: SCHEMA_VERSION,
    });
    expect(a?.createdAt).toBeGreaterThanOrEqual(before);
    expect(a?.createdAt).toBeLessThanOrEqual(after);
    expect(a?.updatedAt).toBeGreaterThanOrEqual(before);
    const l = await db.lineups.get('l1');
    expect(l).toMatchObject({
      ...stripped(lineup, 'createdAt', 'updatedAt'),
      schemaVersion: SCHEMA_VERSION,
    });
    expect(l?.createdAt).toBeGreaterThanOrEqual(before);

    const s = (await db.settings.get('app')) as unknown as Loose;
    expect(s).toMatchObject({ key: 'app', schemaVersion: 1, ui: { theme: 'dark' } });

    // tag multiEntry index survived the upgrade
    expect((await db.plays.where('tags').equals('quick').toArray()).map((p) => p.id)).toEqual(['p1']);
    // new updatedAt index on athletes/lineups is queryable
    expect((await db.athletes.where('updatedAt').aboveOrEqual(before).toArray()).map((x) => x.id)).toEqual([
      'a1',
    ]);
    expect((await db.lineups.where('updatedAt').aboveOrEqual(before).toArray()).map((x) => x.id)).toEqual([
      'l1',
    ]);
  });

  it('does not overwrite existing schemaVersion or timestamps', async () => {
    const name = uniqueName();
    const v1 = new Dexie(name);
    v1.version(1).stores(STORES_V1);
    const athlete = makeAthlete('a1', { createdAt: 5, updatedAt: 9 });
    await v1.table('athletes').put(athlete);
    v1.close();

    const db = new FlagDB(name);
    opened.push(db);
    expect(await db.athletes.get('a1')).toEqual(athlete);
  });

  it('upgrading an empty v1 database works', async () => {
    const name = uniqueName();
    const v1 = new Dexie(name);
    v1.version(1).stores(STORES_V1);
    await v1.open();
    v1.close();
    const db = new FlagDB(name);
    opened.push(db);
    await db.open();
    expect(await db.plays.count()).toBe(0);
  });
});

describe('migrateRecord', () => {
  it('0 → 1 adds schemaVersion, returns a new object and leaves the input untouched', () => {
    const raw = stripped(makePlay('p1'), 'schemaVersion');
    const out = migrateRecord('plays', raw, 0) as Loose;
    expect(out).not.toBe(raw);
    expect(out).toEqual({ ...raw, schemaVersion: SCHEMA_VERSION });
    expect('schemaVersion' in raw).toBe(false);
  });

  it('0 → 1 backfills timestamps for athletes and lineups only', () => {
    const a = migrateRecord(
      'athletes',
      stripped(makeAthlete('a'), 'schemaVersion', 'createdAt', 'updatedAt'),
      0,
    ) as Loose;
    expect(typeof a.createdAt).toBe('number');
    expect(typeof a.updatedAt).toBe('number');
    const l = migrateRecord('lineups', stripped(makeLineup('l'), 'schemaVersion', 'createdAt'), 0) as Loose;
    expect(l.createdAt).toBe(l.updatedAt);
    const m = migrateRecord('matchups', stripped(makeMatchup('m', 'a', 'b'), 'schemaVersion'), 0) as Loose;
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('0 → 1 backfills settings', () => {
    const out = migrateRecord('settings', { key: 'app' }, 0) as Loose;
    expect(out).toEqual({ key: 'app', schemaVersion: SCHEMA_VERSION });
  });

  it('same version → shallow copy', () => {
    const rec = makePlay('p1');
    const out = migrateRecord('plays', rec, SCHEMA_VERSION);
    expect(out).toEqual(rec);
    expect(out).not.toBe(rec);
  });

  it('newer or negative version throws', () => {
    expect(() => migrateRecord('plays', makePlay('p1'), SCHEMA_VERSION + 1)).toThrow();
    expect(() => migrateRecord('plays', makePlay('p1'), -1)).toThrow();
  });

  it('non-object record throws', () => {
    expect(() => migrateRecord('plays', 'nope', 0)).toThrow(TypeError);
    expect(() => migrateRecord('plays', null, 0)).toThrow(TypeError);
  });
});
