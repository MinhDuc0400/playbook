/** Export (FR-IO-01). */
import { athletesRepo, installsRepo, lineupsRepo, matchupsRepo, playsRepo, settingsRepo } from '@/db/repos';
import { SCHEMA_VERSION, type ExportFile } from '@/domain/types';

/** All tables into one ExportFile (app 'flagbook', schemaVersion SCHEMA_VERSION, exportedAt ISO now). */
export async function exportAll(now: Date = new Date()): Promise<ExportFile> {
  const [plays, athletes, lineups, matchups, installs, settings] = await Promise.all([
    playsRepo.list(),
    athletesRepo.list(),
    lineupsRepo.list(),
    matchupsRepo.list(),
    installsRepo.list(),
    settingsRepo.get(),
  ]);
  const data: ExportFile['data'] = { plays, athletes, lineups, matchups, installs };
  if (settings) data.settings = settings;
  return { app: 'flagbook', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

/** Pretty JSON + file name `flagbook-YYYY-MM-DD.json`. */
export function serializeExport(file: ExportFile): { json: string; fileName: string } {
  return {
    json: JSON.stringify(file, null, 2),
    fileName: `flagbook-${file.exportedAt.slice(0, 10)}.json`,
  };
}

/** Browser download via Blob + <a download>; then settingsRepo.update({ lastExportAt: Date.now() }). */
export async function downloadExport(file: ExportFile): Promise<void> {
  const { json, fileName } = serializeExport(file);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await settingsRepo.update({ lastExportAt: Date.now() });
}
