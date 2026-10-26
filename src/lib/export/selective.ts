/** Selective export (FR-IO-06, FR-PB-06). */
import { athletesRepo, installsRepo, lineupsRepo, matchupsRepo, playsRepo } from '@/db/repos';
import { SCHEMA_VERSION, type ExportFile, type ID } from '@/domain/types';

function header(data: ExportFile['data']): ExportFile {
  return { app: 'flagbook', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Only the given plays (no settings). */
export async function exportPlays(playIds: readonly ID[]): Promise<ExportFile> {
  const wanted = new Set(playIds);
  const plays = (await playsRepo.list()).filter((p) => wanted.has(p.id));
  return header({ plays });
}

/** One install + every matchup it references + those matchups' plays (+ their lineups/athletes). */
export async function exportInstallBundle(installId: ID): Promise<ExportFile> {
  const install = await installsRepo.get(installId);
  if (!install) throw new Error(`Install not found: ${installId}`);
  const matchupIds = new Set(install.items.map((i) => i.matchupId));
  const matchups = (await matchupsRepo.list()).filter((m) => matchupIds.has(m.id));
  const playIds = new Set(matchups.flatMap((m) => [m.offensePlayId, m.defensePlayId]));
  const lineupIds = new Set(
    matchups.flatMap((m) => [m.offenseLineupId, m.defenseLineupId].filter((x): x is ID => x !== undefined)),
  );
  const [allPlays, allLineups, allAthletes] = await Promise.all([
    playsRepo.list(),
    lineupsRepo.list(),
    athletesRepo.list(),
  ]);
  const plays = allPlays.filter((p) => playIds.has(p.id));
  const lineups = allLineups.filter((l) => lineupIds.has(l.id));
  const athleteIds = new Set(
    lineups.flatMap((l) => l.slots.map((s) => s.athleteId).filter((x): x is ID => x !== undefined)),
  );
  const athletes = allAthletes.filter((a) => athleteIds.has(a.id));
  return header({ plays, athletes, lineups, matchups, installs: [install] });
}
