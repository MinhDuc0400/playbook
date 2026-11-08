import { describe, expect, it } from 'vitest';
import { computeAreaLanes } from '@/domain/areaLanes';
import type { PlayerSlot, Point } from '@/domain/types';
import { createClaimTracker, SQUEEZE_MIN_DEPTH } from '../areaMatch';
import type { PerceivedPlayer } from '../types';

const def = (id: string, x: number, role: 'corner' | 'inside'): PlayerSlot => ({
  id,
  role: 'CB',
  label: id,
  start: { x, y: 3.5 },
  actions: [],
  areaMatch: { role },
});

// Lanes: 0 = CB2 (x < −4.75), 1 = LB, 2 = S (1.25..6.5), 3 = CB1 (x ≥ 6.5).
const lanes = computeAreaLanes([
  def('CB2', -8, 'corner'),
  def('LB', -1.5, 'inside'),
  def('S', 4, 'inside'),
  def('CB1', 9, 'corner'),
])!;

const rec = (id: string, pos: Point, vel: Point): PerceivedPlayer => ({
  id,
  side: 'offense',
  role: 'WR',
  pos,
  vel,
});

function trackers() {
  const make = (selfIndex: number) =>
    createClaimTracker({ lanes, selfIndex, squeezeAfter: [0.5, 0.5, 0.5, 0.5], minX: -12.5, maxX: 12.5 });
  return { cb2: make(0), lb: make(1), s: make(2), cb1: make(3) };
}

describe('T-AM claim tracker (D-40)', () => {
  it('T-AM-01 Z out first goes to the corner, Y out second goes to S', () => {
    const { cb1, s } = trackers();
    const frame = (t: number, z: Point, y: Point) => [rec('Z', z, { x: 6, y: 0 }), rec('Y', y, { x: 6, y: 0 })];
    for (const tr of [cb1, s]) {
      tr.update(0.1, frame(0.1, { x: 6, y: 1 }, { x: 3, y: 1 }));
      tr.update(0.3, frame(0.3, { x: 7, y: 1 }, { x: 4, y: 1 }));
    }
    expect(cb1.update(0.4, frame(0.4, { x: 7.5, y: 1 }, { x: 5, y: 1 }))).toMatchObject({
      manId: 'Z',
      reason: 'first',
    });
    s.update(0.4, frame(0.4, { x: 7.5, y: 1 }, { x: 5, y: 1 }));
    const view = s.update(0.6, frame(0.6, { x: 8, y: 1 }, { x: 6.8, y: 1 }));
    expect(view).toMatchObject({ manId: 'Y', reason: 'second' });
    expect(view.ignore.has('Z')).toBe(true);
  });

  it('T-AM-02 nobody out: the corner squeezes onto the seam, S stays in zone and plays Z', () => {
    const { cb1, s } = trackers();
    const at = (t: number) => [
      rec('Z', { x: 5 - 4 * t, y: 1 + t }, { x: -5, y: 1 }), // slant inside
      rec('Y', { x: 3, y: 0.5 + 6 * t }, { x: 0, y: 6 }), // seam
    ];
    expect(cb1.update(0.4, at(0.4)).manId).toBeNull();
    s.update(0.4, at(0.4));
    expect(cb1.update(0.5, at(0.5))).toMatchObject({ manId: 'Y', reason: 'squeeze' });
    const view = s.update(0.5, at(0.5));
    expect(view.manId).toBeNull();
    expect(view.ignore.has('Y')).toBe(true);
    expect(view.ignore.has('Z')).toBe(false);
  });

  it('the squeeze waits for a vertical receiver at least SQUEEZE_MIN_DEPTH deep', () => {
    const { cb1 } = trackers();
    const shallow = [rec('Y', { x: 3, y: SQUEEZE_MIN_DEPTH - 1 }, { x: 0, y: 6 })];
    expect(cb1.update(0.5, shallow)).toMatchObject({ manId: null, squeezed: true });
    const deep = [rec('Y', { x: 3, y: SQUEEZE_MIN_DEPTH + 0.5 }, { x: 0, y: 6 })];
    expect(cb1.update(0.7, deep)).toMatchObject({ manId: 'Y', reason: 'squeeze' });
  });

  it('a squeezed corner with nobody vertical still takes the first receiver into its lane', () => {
    const { cb1 } = trackers();
    expect(cb1.update(0.5, [])).toMatchObject({ manId: null, squeezed: true });
    expect(cb1.update(0.8, [rec('H', { x: 7, y: 1 }, { x: 5, y: 0 })])).toMatchObject({
      manId: 'H',
      reason: 'first',
    });
  });

  it('ties go to the receiver nearer the sideline', () => {
    const { cb1, s } = trackers();
    const seen = [rec('Y', { x: 8, y: 0.6 }, { x: 0, y: 5 }), rec('Z', { x: 12, y: 0.6 }, { x: 0, y: 5 })];
    expect(cb1.update(0.1, seen)).toMatchObject({ manId: 'Z', reason: 'first' });
    expect(s.update(0.1, seen)).toMatchObject({ manId: 'Y', reason: 'second' });
  });

  it('claims are sticky', () => {
    const { cb1 } = trackers();
    cb1.update(0.2, [rec('Z', { x: 7, y: 1 }, { x: 5, y: 0 })]);
    expect(cb1.update(0.6, [rec('Z', { x: 4, y: 3 }, { x: -5, y: 0 })]).manId).toBe('Z');
  });

  it('nothing is logged before the snap', () => {
    const { cb1 } = trackers();
    expect(cb1.update(-0.2, [rec('Z', { x: 8, y: -1 }, { x: 3, y: 0 })]).manId).toBeNull();
    expect(cb1.update(0, [rec('Z', { x: 8, y: -1 }, { x: 3, y: 0 })]).manId).toBeNull();
  });

  it('the left side mirrors: CB2 first, LB second', () => {
    const { cb2, lb } = trackers();
    const seen = [rec('X', { x: -6, y: 1 }, { x: -6, y: 0 })];
    cb2.update(0.2, seen);
    lb.update(0.2, seen);
    const later = [rec('X', { x: -7, y: 1 }, { x: -6, y: 0 }), rec('C', { x: -5, y: 1 }, { x: -6, y: 0 })];
    expect(cb2.update(0.4, later).manId).toBe('X');
    expect(lb.update(0.4, later)).toMatchObject({ manId: 'C', reason: 'second' });
  });
});
