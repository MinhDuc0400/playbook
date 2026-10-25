/** First-open seeding (FR-DAT-05). */
import { notImplemented } from '@/domain/notImplemented';

/**
 * If no Settings record exists: write default Settings and the sample plays in one transaction.
 * Idempotent: a second call writes nothing. Returns whether it seeded.
 */
export async function ensureSeeded(now: number = Date.now()): Promise<{ seeded: boolean }> {
  return notImplemented(`ensureSeeded ${now}`);
}
