/** App start-up: seed (FR-DAT-05), persistent storage (FR-IO-04), DB error reporting (NFR-REL-02). */
import { notImplemented } from '@/domain/notImplemented';

export interface BootResult {
  seeded: boolean;
  persisted: boolean | null; // null when navigator.storage.persist is unavailable
}

/**
 * Run once before rendering routes: ensureSeeded(); then, if navigator.storage.persisted() is false,
 * call navigator.storage.persist() (FR-IO-04). Errors are reported via reportDbError, never thrown.
 */
export async function bootstrap(): Promise<BootResult> {
  return notImplemented('bootstrap');
}
