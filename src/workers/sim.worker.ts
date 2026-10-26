/** Sim worker (Comlink-exposed, FR-ENG-11). No lib="webworker" reference: it would leak globals into the app. */
import * as Comlink from 'comlink';
import { simulateMany } from '@/engine/aggregate';
import type { AggregateResult, SimInput } from '@/domain/types';

const api = {
  runMany(input: SimInput, runs: number, onProgress?: (done: number) => void): AggregateResult {
    return simulateMany(input, runs, onProgress);
  },
};

export type SimWorkerApi = typeof api;

Comlink.expose(api);
