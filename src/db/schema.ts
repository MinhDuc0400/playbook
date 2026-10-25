/**
 * Dexie schema (SRS §5.7, D-07). Lead-owned wiring.
 * v1 = SRS stores; v2 adds updatedAt indexes on athletes/lineups and backfills
 * schemaVersion / timestamps (FR-DAT-01 migration, see migrations.ts).
 */
import Dexie, { type Table } from 'dexie';
import type { Athlete, ID, Install, Lineup, Matchup, Play, Settings } from '@/domain/types';
import { upgradeToV2 } from './migrations';

export const DB_NAME = 'flagbook';

export const STORES_V1 = {
  plays: 'id, side, format, name, formation, *tags, updatedAt',
  athletes: 'id, name, preset',
  lineups: 'id, side, format, name',
  matchups: 'id, offensePlayId, defensePlayId, updatedAt',
  installs: 'id, name, updatedAt',
  settings: 'key',
} as const;

export const STORES_V2 = {
  ...STORES_V1,
  athletes: 'id, name, preset, updatedAt',
  lineups: 'id, side, format, name, updatedAt',
} as const;

export class FlagDB extends Dexie {
  plays!: Table<Play, ID>;
  athletes!: Table<Athlete, ID>;
  lineups!: Table<Lineup, ID>;
  matchups!: Table<Matchup, ID>;
  installs!: Table<Install, ID>;
  settings!: Table<Settings, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(STORES_V1);
    this.version(2).stores(STORES_V2).upgrade(upgradeToV2);
  }
}

let instance: FlagDB | null = null;

/** App-wide DB singleton. */
export function getDb(): FlagDB {
  if (!instance) instance = new FlagDB();
  return instance;
}

/** Close and delete the DB, then reopen a fresh empty one (tests, "replace all" import). */
export async function resetDb(): Promise<FlagDB> {
  const db = getDb();
  db.close();
  await Dexie.delete(db.name);
  instance = new FlagDB(db.name);
  await instance.open();
  return instance;
}
