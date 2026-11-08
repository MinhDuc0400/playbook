import { describe, expect, it } from 'vitest';
import { goalLineY } from '@/domain/field';
import { simulate } from '../simulate';
import { cover3Play, floodPlay, makeInput } from './fixtures';

describe('T-TD-01 touchdown (D-41)', () => {
  it('a catch at or past the goal line is a touchdown, short of it is not', () => {
    let tds = 0;
    for (const yardLine of [45, 25]) {
      for (let seed = 1; seed <= 20; seed++) {
        const input = makeInput(floodPlay(), cover3Play(), {
          ballSpot: { x: 0, yardLine },
          noise: true,
          seed,
        });
        const r = simulate(input);
        if (r.outcome.kind !== 'complete') continue;
        const goal = goalLineY(input.field, input.ballSpot);
        expect(r.outcome.touchdown === true).toBe(r.outcome.yards >= goal);
        if (r.outcome.touchdown) tds += 1;
      }
    }
    expect(tds).toBeGreaterThan(0);
  });
});
