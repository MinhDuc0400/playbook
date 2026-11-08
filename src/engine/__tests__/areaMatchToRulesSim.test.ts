import { describe, expect, it } from 'vitest';
import { areaMatchToRules } from '@/domain/areaMatchToRules';
import { createDefaultFields } from '@/domain/field';
import { simulate } from '../simulate';
import { bangkokPlay, bunchTightPlay, floodPlay, makeInput } from './fixtures';

const RED_ZONE = { x: 0, yardLine: 45 };
const field = createDefaultFields()['5v5'];

describe('D-48 conversion keeps Bunch Killer behaviour', () => {
  const offenses = {
    'T-AM-01': bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } }),
    'T-AM-02': bunchTightPlay({ x: 'hitch', c: 'hitch', y: 'go', z: 'slant' }),
    'T-AM-04': floodPlay(),
  };
  for (const [name, off] of Object.entries(offenses)) {
    it(`${name}: the converted defense gives the same frames as the old one`, () => {
      for (const variant of ['rush', 'spy'] as const) {
        const old = bangkokPlay(variant);
        const converted = areaMatchToRules(old, field);
        const a = simulate(makeInput(off, old, { ballSpot: RED_ZONE }));
        const b = simulate(makeInput(off, converted, { ballSpot: RED_ZONE }));
        expect(b.frames).toEqual(a.frames);
        expect(b.outcome).toEqual(a.outcome);
      }
    });
  }
});
