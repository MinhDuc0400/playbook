/** simulateMany (SRS §8.1, FR-ENG-11). Pure; runs in the Worker. */
import { notImplemented } from '@/domain/notImplemented';
import type { AggregateResult, SimInput, SimResult } from '@/domain/types';

/** Seeds used for run i: input.seed + i. Noise as in input. */
export function simulateMany(
  input: SimInput,
  runs: number,
  onProgress?: (done: number) => void,
): AggregateResult {
  return notImplemented(`simulateMany ${input.seed}${runs}${String(onProgress)}`);
}

/** Fold a list of results into an AggregateResult (avgYards per attempt; perTarget; targetDistribution). */
export function aggregate(results: readonly SimResult[], receiverIds: readonly string[]): AggregateResult {
  return notImplemented(`aggregate ${results.length}${receiverIds.length}`);
}
