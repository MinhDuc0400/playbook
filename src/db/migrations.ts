/**
 * Schema migrations (FR-DAT-01).
 * - upgradeToV2: Dexie v1 → v2 upgrade; backfills schemaVersion on every record and createdAt/updatedAt
 *   on athletes/lineups (D-07). Must keep all existing data.
 * - upgradeToV3 (D-48): Dexie v2 → v3; converts Bunch Killer `areaMatch` plays to area rules and sets
 *   schemaVersion 2 on every record.
 * - upgradeToV4 (D-51): Dexie v3 → v4; lane rectangles frozen into polygon zones become the live 'lane' zone
 *   and every record gets schemaVersion 3.
 * - migrateRecord: per-record migration used by JSON import (FR-IO-02) for files with an older
 *   schemaVersion (0 = records written before schemaVersion existed).
 */
import type { Transaction } from 'dexie';
import { areaMatchToRules } from '@/domain/areaMatchToRules';
import { liveLaneZones } from '@/domain/areaRules';
import { SCHEMA_VERSION, type Play } from '@/domain/types';

export type TableName = 'plays' | 'athletes' | 'lineups' | 'matchups' | 'installs' | 'settings';

const TABLES: readonly TableName[] = ['plays', 'athletes', 'lineups', 'matchups', 'installs', 'settings'];
const TIMESTAMPED: ReadonlySet<TableName> = new Set<TableName>(['athletes', 'lineups']);

type Raw = Record<string, unknown>;

/** Mutate `rec` in place to the v1 shape (schemaVersion, plus timestamps on athletes/lineups). */
function backfillV1(table: TableName, rec: Raw, now: number): void {
  if (typeof rec.schemaVersion !== 'number') rec.schemaVersion = SCHEMA_VERSION;
  if (TIMESTAMPED.has(table)) {
    if (typeof rec.createdAt !== 'number')
      rec.createdAt = typeof rec.updatedAt === 'number' ? rec.updatedAt : now;
    if (typeof rec.updatedAt !== 'number') rec.updatedAt = rec.createdAt as number;
  }
}

export async function upgradeToV2(tx: Transaction): Promise<void> {
  const now = Date.now();
  for (const name of TABLES) {
    await tx
      .table(name)
      .toCollection()
      .modify((rec: Raw) => {
        backfillV1(name, rec, now);
      });
  }
}

/** schemaVersion 1 → 2 for one record (D-48): plays get their `areaMatch` converted. */
function toV2(table: TableName, rec: Raw): Raw {
  const out = table === 'plays' ? (areaMatchToRules(rec as unknown as Play) as unknown as Raw) : rec;
  return { ...out, schemaVersion: 2 };
}

/** schemaVersion 2 → 3 for one record (D-51): frozen lane rectangles become the live 'lane' zone. */
function toV3(table: TableName, rec: Raw): Raw {
  const out = table === 'plays' ? (liveLaneZones(rec as unknown as Play) as unknown as Raw) : rec;
  return { ...out, schemaVersion: 3 };
}

async function upgradeEach(tx: Transaction, step: (table: TableName, rec: Raw) => Raw): Promise<void> {
  for (const name of TABLES) {
    await tx
      .table(name)
      .toCollection()
      .modify((rec: Raw, ref: { value: Raw }) => {
        ref.value = step(name, rec);
      });
  }
}

export async function upgradeToV3(tx: Transaction): Promise<void> {
  await upgradeEach(tx, toV2);
}

export async function upgradeToV4(tx: Transaction): Promise<void> {
  await upgradeEach(tx, toV3);
}

/**
 * Bring one raw record of `table` from `fromVersion` up to SCHEMA_VERSION. Returns a new object.
 * Throws if fromVersion > SCHEMA_VERSION.
 */
export function migrateRecord(table: TableName, record: unknown, fromVersion: number): unknown {
  if (!Number.isInteger(fromVersion) || fromVersion < 0 || fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `cannot migrate ${table} record from schemaVersion ${String(fromVersion)} (current ${SCHEMA_VERSION})`,
    );
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new TypeError(`cannot migrate ${table} record: not an object`);
  }
  let copy: Raw = { ...(record as Raw) };
  if (fromVersion === 0) {
    backfillV1(table, copy, Date.now());
    copy.schemaVersion = 1;
  }
  if (fromVersion < 2) copy = toV2(table, copy);
  if (fromVersion < 3) copy = toV3(table, copy);
  return copy;
}
