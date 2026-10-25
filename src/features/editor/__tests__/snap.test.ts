import { describe, expect, it } from 'vitest';
import { snapPoint } from '../snap';

describe('snapPoint (FR-ED-03)', () => {
  it('snaps to the 0.5 yd grid', () => {
    expect(snapPoint({ x: 3.2, y: -1.8 }, { snap: true, alt: false })).toEqual({ x: 3, y: -2 });
    expect(snapPoint({ x: 3.3, y: 0.76 }, { snap: true, alt: false })).toEqual({ x: 3.5, y: 1 });
  });

  it('returns the raw point when Alt is held', () => {
    expect(snapPoint({ x: 3.2, y: -1.8 }, { snap: true, alt: true })).toEqual({ x: 3.2, y: -1.8 });
  });

  it('returns the raw point when snapping is off', () => {
    expect(snapPoint({ x: 3.2, y: -1.8 }, { snap: false, alt: false })).toEqual({ x: 3.2, y: -1.8 });
  });
});
