/** Import (FR-IO-02, FR-IO-03). */
import { notImplemented } from '@/domain/notImplemented';
import type { ExportFile } from '@/domain/types';

export type ImportMode = 'merge' | 'replace';
/** merge: same id → keep newer updatedAt ('newer') or import as a copy with a new id ('copy'). */
export type MergeStrategy = 'newer' | 'copy';

export interface TableReport {
  added: number;
  updated: number;
  skipped: number;
}
export interface ImportReport {
  plays: TableReport;
  athletes: TableReport;
  lineups: TableReport;
  matchups: TableReport;
  installs: TableReport;
  settings: TableReport;
}

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; errors: string[] };

/** JSON.parse + migrate (migrateRecord) + zod validation. Never throws. */
export function parseImport(text: string): ParseResult {
  return notImplemented(`parseImport ${text.length}`);
}

/**
 * Write a parsed file in ONE rw transaction over all tables (nothing written on failure).
 * replace: clear every table first, then add all. merge: per record by id (see MergeStrategy); copies get
 * new ids and references (matchup play ids, install matchup ids) are remapped within the file.
 */
export async function importData(
  file: ExportFile,
  mode: ImportMode,
  strategy?: MergeStrategy,
): Promise<ImportReport> {
  return notImplemented(`importData ${file.exportedAt}${mode}${String(strategy)}`);
}
