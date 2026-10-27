import { describe, expect, it } from 'vitest';
import { featuresFor } from '../features';

describe('featuresFor (D-26)', () => {
  it('Simple mode hides every advanced feature', () => {
    const f = featuresFor(false);
    expect(Object.values(f).every((v) => v === false)).toBe(true);
  });
  it('Advanced mode shows everything', () => {
    const f = featuresFor(true);
    expect(Object.values(f).every((v) => v === true)).toBe(true);
  });
});
