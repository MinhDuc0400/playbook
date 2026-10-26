import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { simulate } from '../simulate';
import { cover3Play, floodPlay, makeInput } from './fixtures';

/** NFR-PERF-02 budget: 5v5 6 s < 20 ms. T-ENG-11 fails at 2x the budget. */
const BUDGET_MS = 20;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

function medianMs(input: ReturnType<typeof makeInput>): number {
  for (let i = 0; i < 3; i++) simulate({ ...input, seed: i });
  const times: number[] = [];
  for (let i = 0; i < 15; i++) {
    const t0 = performance.now();
    simulate({ ...input, seed: 100 + i });
    times.push(performance.now() - t0);
  }
  return median(times);
}

describe('T-ENG-11 performance', () => {
  it('Trips Flood vs Cover 3, 6 s: median of 15 runs under 2x the budget', () => {
    const input = makeInput(floodPlay(), cover3Play(), { noise: true });
    input.tuning.maxTime = 6;
    const m = medianMs(input);
    console.info(`T-ENG-11 flood vs cover 3 median ${m.toFixed(2)} ms`);
    expect(m).toBeLessThan(2 * BUDGET_MS);
  });

  it('full 6 s play (QB never throws, no rusher): median of 15 runs under 2x the budget', () => {
    const input = makeInput(floodPlay(), cover3Play(), { noise: true });
    input.tuning.maxTime = 6;
    input.offenseStats['f-q'] = { ...DEFAULT_PRESETS.avg, armRange: 0 };
    input.defense = { ...input.defense, players: input.defense.players.filter((p) => p.role !== 'R') };
    const m = medianMs(input);
    console.info(`T-ENG-11 full 6 s median ${m.toFixed(2)} ms`);
    expect(m).toBeLessThan(2 * BUDGET_MS);
  });
});
