/**
 * Schema migrations (FR-DAT-01).
 * - upgradeToV2: Dexie v1 → v2 upgrade; backfills schemaVersion on every record and createdAt/updatedAt
 *   on athletes/lineups (D-07). Must keep all existing data.
 * - upgradeToV3 (D-48): Dexie v2 → v3; converts Bunch Killer `areaMatch` plays to area rules and sets
 *   schemaVersion 2 on every record.
 * - migrateRecord: per-record migration used by JSON import (FR-IO-02) for files with an older
 *   schemaVersion (0 = records written before schemaVersion existed).
 */
import type { Transaction } from 'dexie';
import { areaMatchToRules } from '@/domain/areaMatchToRules';
import { createDefaultFields } from '@/domain/field';
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

/** Field used to freeze converted lane rectangles (a Play stores no ball spot; ball centred). */
const CONVERT_FIELD = createDefaultFields()['5v5'];

/** schemaVersion 1 → 2 for one record (D-48): plays get their `areaMatch` converted. */
function toV2(table: TableName, rec: Raw): Raw {
  const out =
    table === 'plays' ? (areaMatchToRules(rec as unknown as Play, CONVERT_FIELD) as unknown as Raw) : rec;
  return { ...out, schemaVersion: 2 };
}

export async function upgradeToV3(tx: Transaction): Promise<void> {
  for (const name of TABLES) {
    await tx
      .table(name)
      .toCollection()
      .modify((rec: Raw, ref: { value: Raw }) => {
        ref.value = toV2(name, rec);
      });
  }
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
  return copy;
}
