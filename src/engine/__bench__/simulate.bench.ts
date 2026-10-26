import { bench, describe } from 'vitest';
import { simulate } from '../simulate';
import { cover3Play, floodPlay, makeInput } from '../__tests__/fixtures';

describe('simulate', () => {
  const input = makeInput(floodPlay(), cover3Play(), { noise: true });
  input.tuning.maxTime = 6;
  let seed = 0;
  bench('Trips Flood vs Cover 3 (5v5, 6 s)', () => {
    simulate({ ...input, seed: seed++ });
  });
});
