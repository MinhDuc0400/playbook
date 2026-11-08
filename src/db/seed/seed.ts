/** First-open seeding (FR-DAT-05, FR-DAT-04) and versioned sample content (D-42). */
import { createDefaultSettings } from '@/domain/defaults';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';
import { createBangkokContent } from './bangkok';
import { createSamplePlays } from './samplePlays';

/** Version of the built-in sample content. 1 = the 6 sample plays, 2 = + Bunch Killer (Bangkok). */
export const SEED_VERSION = 2;

/**
 * - No Settings record: write default Settings (seedVersion = SEED_VERSION), the sample plays and the v2
 *   content in one transaction → { seeded: true }.
 * - Settings with seedVersion missing or < 2: add each v2 record (plays, matchups, install) whose fixed id is
 *   missing (a matchup only when both its plays exist), then set seedVersion = 2. Never overwrites; something deleted later is not re-added.
 * Idempotent. Returns whether it seeded a fresh DB.
 */
export async function ensureSeeded(now: number = Date.now()): Promise<{ seeded: boolean }> {
  return withDbErrors(async () => {
    const db = getDb();
    return db.transaction('rw', [db.settings, db.plays, db.matchups, db.installs], async () => {
      const settings = await db.settings.get('app');
      if (!settings) {
        const fresh = { ...createDefaultSettings(), seedVersion: SEED_VERSION };
        const v2 = createBangkokContent(now, fresh.fields['5v5']);
        await db.settings.put(fresh);
        await db.plays.bulkPut([...createSamplePlays(now), ...v2.plays]);
        await db.matchups.bulkPut(v2.matchups);
        await db.installs.put(v2.install);
        return { seeded: true };
      }
      if ((settings.seedVersion ?? 1) < 2) {
        const v2 = createBangkokContent(now, settings.fields['5v5']);
        for (const p of v2.plays) if (!(await db.plays.get(p.id))) await db.plays.put(p);
        // A matchup is only added when both its plays exist (the user may have deleted Trips Flood).
        const kept: string[] = [];
        for (const m of v2.matchups) {
          const ok = (await db.plays.get(m.offensePlayId)) && (await db.plays.get(m.defensePlayId));
          if (!ok) continue;
          kept.push(m.id);
          if (!(await db.matchups.get(m.id))) await db.matchups.put(m);
        }
        if (!(await db.installs.get(v2.install.id))) {
          const items = v2.install.items
            .filter((it) => kept.includes(it.matchupId))
            .map((it, order) => ({ ...it, order }));
          await db.installs.put({ ...v2.install, items });
        }
        await db.settings.put({ ...settings, seedVersion: SEED_VERSION });
      }
      return { seeded: false };
    });
  });
}
