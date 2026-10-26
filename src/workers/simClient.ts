/**
 * Main-thread client for the sim Worker (Comlink, FR-ENG-11, NFR-PERF-03). Keeps the UI responsive.
 * Falls back to running in-thread when Worker is unavailable (tests/jsdom).
 */
import * as Comlink from 'comlink';
import type { AggregateResult, SimInput, SimResult } from '@/domain/types';
import { aggregate, receiverIdsOf, runInput } from '@/engine/aggregate';
import { simulate } from '@/engine/simulate';
import type { SimWorkerApi } from './sim.worker';

export interface RunManyHandle {
  promise: Promise<AggregateResult>;
  cancel(): void; // terminates the worker job; promise rejects with an AbortError
}

const abortError = (): DOMException => new DOMException('Aborted', 'AbortError');

function runInWorker(
  input: SimInput,
  runs: number,
  onProgress?: (done: number, total: number) => void,
): RunManyHandle {
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
  const api = Comlink.wrap<SimWorkerApi>(worker);
  let abort: (() => void) | null = null;
  const promise = new Promise<AggregateResult>((resolve, reject) => {
    abort = () => reject(abortError());
    const progress = Comlink.proxy((done: number) => onProgress?.(done, runs));
    api.runMany(input, runs, progress).then(resolve, reject);
  }).finally(() => {
    api[Comlink.releaseProxy]();
    worker.terminate();
  });
  return {
    promise,
    cancel() {
      abort?.();
    },
  };
}

function runInThread(
  input: SimInput,
  runs: number,
  onProgress?: (done: number, total: number) => void,
): RunManyHandle {
  let cancelled = false;
  let abort: (() => void) | null = null;
  const promise = new Promise<AggregateResult>((resolve, reject) => {
    abort = () => reject(abortError());
    const results: SimResult[] = [];
    const step = (): void => {
      if (cancelled) return;
      if (results.length >= runs) {
        resolve(aggregate(results, receiverIdsOf(input)));
        return;
      }
      results.push(simulate(runInput(input, results.length)));
      onProgress?.(results.length, runs);
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  });
  return {
    promise,
    cancel() {
      cancelled = true;
      abort?.();
    },
  };
}

export function runMany(
  input: SimInput,
  runs: number,
  onProgress?: (done: number, total: number) => void,
): RunManyHandle {
  return typeof Worker === 'undefined'
    ? runInThread(input, runs, onProgress)
    : runInWorker(input, runs, onProgress);
}
