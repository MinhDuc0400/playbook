/**
 * Main-thread client for the sim Worker (Comlink, FR-ENG-11, NFR-PERF-03). Keeps the UI responsive.
 * Falls back to running in-thread when Worker is unavailable (tests/jsdom).
 */
import { notImplemented } from '@/domain/notImplemented';
import type { AggregateResult, SimInput } from '@/domain/types';

export interface RunManyHandle {
  promise: Promise<AggregateResult>;
  cancel(): void; // terminates the worker job; promise rejects with an AbortError
}

export function runMany(
  input: SimInput,
  runs: number,
  onProgress?: (done: number, total: number) => void,
): RunManyHandle {
  return notImplemented(`runMany ${input.seed}${runs}${String(onProgress)}`);
}
