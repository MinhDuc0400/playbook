/** Export (FR-IO-01). */
import { notImplemented } from '@/domain/notImplemented';
import type { ExportFile } from '@/domain/types';

/** All tables into one ExportFile (app 'flagbook', schemaVersion SCHEMA_VERSION, exportedAt ISO now). */
export async function exportAll(now?: Date): Promise<ExportFile> {
  return notImplemented(`exportAll ${String(now)}`);
}

/** Pretty JSON + file name `flagbook-YYYY-MM-DD.json`. */
export function serializeExport(file: ExportFile): { json: string; fileName: string } {
  return notImplemented(`serializeExport ${file.exportedAt}`);
}

/** Browser download via Blob + <a download>; then settingsRepo.update({ lastExportAt: Date.now() }). */
export async function downloadExport(file: ExportFile): Promise<void> {
  return notImplemented(`downloadExport ${file.exportedAt}`);
}
