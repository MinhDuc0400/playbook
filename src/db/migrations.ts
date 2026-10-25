/**
 * Schema migrations (FR-DAT-01).
 * - upgradeToV2: Dexie v1 → v2 upgrade; backfills schemaVersion on every record and createdAt/updatedAt
 *   on athletes/lineups (D-07). Must keep all existing data.
 * - migrateRecord: per-record migration used by JSON import (FR-IO-02) for files with an older
 *   schemaVersion (0 = records written before schemaVersion existed).
 */
import type { Transaction } from 'dexie';
import { notImplemented } from '@/domain/notImplemented';

export type TableName = 'plays' | 'athletes' | 'lineups' | 'matchups' | 'installs' | 'settings';

export async function upgradeToV2(tx: Transaction): Promise<void> {
  return notImplemented(`upgradeToV2 ${String(tx)}`);
}

/**
 * Bring one raw record of `table` from `fromVersion` up to SCHEMA_VERSION. Returns a new object.
 * Throws if fromVersion > SCHEMA_VERSION.
 */
export function migrateRecord(table: TableName, record: unknown, fromVersion: number): unknown {
  return notImplemented(`migrateRecord ${table}${String(record)}${fromVersion}`);
}
