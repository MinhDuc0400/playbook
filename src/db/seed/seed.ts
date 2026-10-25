/** First-open seeding (FR-DAT-05, FR-DAT-04). */
import { createDefaultSettings } from '@/domain/defaults';
import { withDbErrors } from '../errors';
import { getDb } from '../schema';
import { createSamplePlays } from './samplePlays';

/**
 * If no Settings record exists: write default Settings and the sample plays in one transaction.
 * Idempotent: a second call writes nothing. Returns whether it seeded.
 */
export async function ensureSeeded(now: number = Date.now()): Promise<{ seeded: boolean }> {
  return withDbErrors(async () => {
    const db = getDb();
    return db.transaction('rw', db.settings, db.plays, async () => {
      if (await db.settings.get('app')) return { seeded: false };
      await db.settings.put(createDefaultSettings());
      await db.plays.bulkPut(createSamplePlays(now));
      return { seeded: true };
    });
  });
}
