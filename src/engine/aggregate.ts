/** simulateMany (SRS §8.1, FR-ENG-11). Pure; runs in the Worker. */
import type { AggregateResult, ID, OutcomeKind, SimInput, SimResult } from '@/domain/types';
import { simulate } from './simulate';

const OUTCOME_KINDS: readonly OutcomeKind[] = [
  'complete',
  'incomplete',
  'deflected',
  'intercepted',
  'sack',
  'throwaway',
  'timeout',
];

/** Offense slot ids that can be targeted (everyone but the QB). */
export function receiverIdsOf(input: SimInput): ID[] {
  return input.offense.players.filter((s) => s.role !== 'QB').map((s) => s.id);
}

/** Input for run i: same everything, seed + i. */
export function runInput(input: SimInput, i: number): SimInput {
  return { ...input, seed: input.seed + i };
}

/** Seeds used for run i: input.seed + i. Noise as in input. */
export function simulateMany(
  input: SimInput,
  runs: number,
  onProgress?: (done: number) => void,
): AggregateResult {
  const results: SimResult[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(simulate(runInput(input, i)));
    onProgress?.(i + 1);
  }
  return aggregate(results, receiverIdsOf(input));
}

/** Fold a list of results into an AggregateResult (avgYards per attempt; perTarget; targetDistribution). */
export function aggregate(results: readonly SimResult[], receiverIds: readonly ID[]): AggregateResult {
  const runs = results.length;
  const outcomes = Object.fromEntries(OUTCOME_KINDS.map((k) => [k, 0])) as Record<OutcomeKind, number>;
  const targetCount: Record<ID, number> = {};
  const perTarget: AggregateResult['perTarget'] = {};
  const sepSum: Record<ID, { sum: number; n: number }> = {};
  const perTargetSep: Record<ID, { sum: number; n: number }> = {};
  for (const id of receiverIds) {
    targetCount[id] = 0;
    perTarget[id] = { throws: 0, completes: 0, avgSepAtThrow: 0 };
    sepSum[id] = { sum: 0, n: 0 };
    perTargetSep[id] = { sum: 0, n: 0 };
  }
  const readCount: Record<string, number> = {};
  let yards = 0;
  let completes = 0;
  let ttSum = 0;
  let ttN = 0;

  for (const r of results) {
    outcomes[r.outcome.kind] += 1;
    if (r.outcome.kind === 'complete') {
      completes += 1;
      yards += r.outcome.yards;
    }
    if (r.metrics.timeToThrow !== undefined) {
      ttSum += r.metrics.timeToThrow;
      ttN += 1;
    }
    const sep = r.metrics.separationAtThrow;
    if (sep) {
      for (const [id, d] of Object.entries(sep)) {
        const acc = (sepSum[id] ??= { sum: 0, n: 0 });
        acc.sum += d;
        acc.n += 1;
      }
    }
    const dec = r.metrics.reads?.decision;
    if (dec) {
      const key = dec.kind === 'read' ? String((dec.readIndex ?? 0) + 1) : dec.kind;
      readCount[key] = (readCount[key] ?? 0) + 1;
    }
    const thrown = r.events.find((e) => e.type === 'throw');
    const tid = thrown?.targetId;
    if (tid !== undefined) {
      targetCount[tid] = (targetCount[tid] ?? 0) + 1;
      const pt = (perTarget[tid] ??= { throws: 0, completes: 0, avgSepAtThrow: 0 });
      pt.throws += 1;
      if (r.outcome.kind === 'complete' && r.outcome.targetId === tid) pt.completes += 1;
      const d = sep?.[tid];
      if (d !== undefined) {
        const acc = (perTargetSep[tid] ??= { sum: 0, n: 0 });
        acc.sum += d;
        acc.n += 1;
      }
    }
  }

  const targetDistribution: Record<ID, number> = {};
  for (const [id, n] of Object.entries(targetCount)) targetDistribution[id] = runs > 0 ? n / runs : 0;
  for (const [id, acc] of Object.entries(perTargetSep)) {
    const pt = perTarget[id];
    if (pt) pt.avgSepAtThrow = acc.n > 0 ? acc.sum / acc.n : 0;
  }
  const readDistribution: Record<string, number> = {};
  for (const [k, n] of Object.entries(readCount)) readDistribution[k] = runs > 0 ? n / runs : 0;
  const avgSeparationAtThrow: Record<ID, number> = {};
  for (const [id, acc] of Object.entries(sepSum)) {
    if (acc.n > 0) avgSeparationAtThrow[id] = acc.sum / acc.n;
  }

  return {
    runs,
    outcomes,
    pComplete: runs > 0 ? outcomes.complete / runs : 0,
    pSack: runs > 0 ? outcomes.sack / runs : 0,
    pInt: runs > 0 ? outcomes.intercepted / runs : 0,
    avgYards: runs > 0 ? yards / runs : 0,
    avgYardsPerCompletion: completes > 0 ? yards / completes : 0,
    avgTimeToThrow: ttN > 0 ? ttSum / ttN : null,
    targetDistribution,
    perTarget,
    avgSeparationAtThrow,
    readDistribution,
  };
}
