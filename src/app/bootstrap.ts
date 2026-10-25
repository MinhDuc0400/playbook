/** App start-up: seed (FR-DAT-05), persistent storage (FR-IO-04), DB error reporting (NFR-REL-02). */
import { reportDbError } from '@/db/errors';
import { ensureSeeded } from '@/db/seed/seed';

export interface BootResult {
  seeded: boolean;
  persisted: boolean | null; // null when navigator.storage.persist is unavailable
}

/**
 * Run once before rendering routes: ensureSeeded(); then, if navigator.storage.persisted() is false,
 * call navigator.storage.persist() (FR-IO-04). Errors are reported via reportDbError, never thrown.
 */
export async function bootstrap(): Promise<BootResult> {
  const result: BootResult = { seeded: false, persisted: null };
  try {
    result.seeded = (await ensureSeeded()).seeded;
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (storage && typeof storage.persisted === 'function' && typeof storage.persist === 'function') {
      let persisted = await storage.persisted();
      if (!persisted) persisted = await storage.persist();
      result.persisted = persisted;
    }
  } catch (e) {
    result.seeded = false;
    reportDbError(e);
  }
  return result;
}
