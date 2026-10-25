/** IndexedDB error classification and broadcast (NFR-REL-02). */

export type DbErrorKind = 'quota' | 'blocked' | 'unknown';

export interface DbErrorInfo {
  kind: DbErrorKind;
  message: string;
  at: number;
}

const BLOCKED_NAMES = new Set([
  'OpenFailedError',
  'DatabaseClosedError',
  'InvalidStateError',
  'VersionError',
]);
const MAX_DEPTH = 6;

/** Flatten an error and its `inner` / `cause` chain (Dexie wraps the original DOMException in `inner`). */
function errorChain(e: unknown): { name: string; message: string }[] {
  const out: { name: string; message: string }[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = e;
  for (let depth = 0; depth < MAX_DEPTH && typeof cur === 'object' && cur !== null; depth++) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const rec = cur as { name?: unknown; message?: unknown; inner?: unknown; cause?: unknown };
    out.push({
      name: typeof rec.name === 'string' ? rec.name : '',
      message: typeof rec.message === 'string' ? rec.message : '',
    });
    cur = rec.inner ?? rec.cause;
  }
  return out;
}

/** QuotaExceededError → 'quota'; Dexie OpenFailed/DatabaseClosed/blocked/InvalidState → 'blocked'. */
export function classifyDbError(e: unknown): DbErrorKind {
  const chain = errorChain(e);
  if (chain.some((c) => c.name === 'QuotaExceededError')) return 'quota';
  if (chain.some((c) => BLOCKED_NAMES.has(c.name) || c.message.toLowerCase().includes('blocked'))) {
    return 'blocked';
  }
  return 'unknown';
}

const listeners = new Set<(info: DbErrorInfo) => void>();

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return String(e);
}

/** Record an error and notify listeners. */
export function reportDbError(e: unknown): DbErrorInfo {
  const info: DbErrorInfo = { kind: classifyDbError(e), message: messageOf(e), at: Date.now() };
  for (const listener of [...listeners]) {
    try {
      listener(info);
    } catch {
      // a failing listener must not block the others or mask the original error
    }
  }
  return info;
}

/** Subscribe to reported errors. Returns unsubscribe. */
export function onDbError(listener: (info: DbErrorInfo) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Run a DB operation; on failure reportDbError() then rethrow. */
export async function withDbErrors<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    reportDbError(e);
    throw e;
  }
}
