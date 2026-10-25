/** IndexedDB error classification and broadcast (NFR-REL-02). */
import { notImplemented } from '@/domain/notImplemented';

export type DbErrorKind = 'quota' | 'blocked' | 'unknown';

export interface DbErrorInfo {
  kind: DbErrorKind;
  message: string;
  at: number;
}

/** QuotaExceededError → 'quota'; Dexie OpenFailed/DatabaseClosed/blocked/InvalidState → 'blocked'. */
export function classifyDbError(e: unknown): DbErrorKind {
  return notImplemented(`classifyDbError ${String(e)}`);
}

/** Record an error and notify listeners. */
export function reportDbError(e: unknown): DbErrorInfo {
  return notImplemented(`reportDbError ${String(e)}`);
}

/** Subscribe to reported errors. Returns unsubscribe. */
export function onDbError(listener: (info: DbErrorInfo) => void): () => void {
  return notImplemented(`onDbError ${String(listener)}`);
}

/** Run a DB operation; on failure reportDbError() then rethrow. */
export async function withDbErrors<T>(op: () => Promise<T>): Promise<T> {
  return notImplemented(`withDbErrors ${String(op)}`);
}
