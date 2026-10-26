/** Selective export (FR-IO-06, FR-PB-06). */
import { notImplemented } from '@/domain/notImplemented';
import type { ExportFile, ID } from '@/domain/types';

/** Only the given plays (no settings). */
export async function exportPlays(playIds: readonly ID[]): Promise<ExportFile> {
  return notImplemented(`exportPlays ${playIds.length}`);
}

/** One install + every matchup it references + those matchups' plays (+ their lineups/athletes). */
export async function exportInstallBundle(installId: ID): Promise<ExportFile> {
  return notImplemented(`exportInstallBundle ${installId}`);
}
