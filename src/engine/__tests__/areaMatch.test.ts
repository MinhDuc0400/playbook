import { describe, expect, it } from 'vitest';
import { computeAreaLanes } from '@/domain/areaLanes';
import type { PlayerSlot, Point } from '@/domain/types';
import { createClaimTracker } from '../areaMatch';
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
  const make = (selfIndex: number) => createClaimTracker({ lanes, selfIndex, minX: -12.5, maxX: 12.5 });
  return { cb2: make(0), lb: make(1), s: make(2), cb1: make(3) };
}

describe('T-AM claim tracker (D-40)', () => {
  it('T-AM-01 Z out first goes to the corner, Y out second goes to S', () => {
    const { cb1, s } = trackers();
    const frame = (_t: number, z: Point, y: Point) => [
      rec('Z', z, { x: 6, y: 0 }),
      rec('Y', y, { x: 6, y: 0 }),
    ];
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

  it('T-AM-02 nobody out: the corner stays with no man however long it takes; S stays in zone', () => {
    const { cb1, s } = trackers();
    const at = (t: number) => [
      rec('Z', { x: 5 - 4 * t, y: 1 + t }, { x: -5, y: 1 }), // slant inside
      rec('Y', { x: 3, y: 0.5 + 6 * t }, { x: 0, y: 6 }), // seam in S's lane
    ];
    for (const t of [0.4, 0.5, 1, 2, 3]) {
      const view = cb1.update(t, at(t));
      expect(view.manId).toBeNull();
      expect(view.reason).toBeNull();
      const sv = s.update(t, at(t));
      expect(sv.manId).toBeNull();
      expect(sv.ignore.has('Y')).toBe(false);
    }
  });

  it('T-AM-07 a receiver breaking out into the corner lane is the corner first-in; S does not take him', () => {
    const { cb1, s } = trackers();
    // Y seam 3.5 yd deep in S's lane; C breaking out fast toward CB1's lane (x ≥ 6.5).
    const before = [
      rec('Y', { x: 3, y: 3.5 }, { x: 0, y: 6 }),
      rec('C', { x: 3.3, y: 2.3 }, { x: 6.5, y: 1.8 }),
    ];
    expect(cb1.update(0.9, before)).toMatchObject({ manId: null });
    s.update(0.9, before);
    const after = [
      rec('Y', { x: 3, y: 4.7 }, { x: 0, y: 6 }),
      rec('C', { x: 6.8, y: 2.6 }, { x: 6.5, y: 1.8 }),
    ];
    expect(cb1.update(1.1, after)).toMatchObject({ manId: 'C', reason: 'first' });
    const view = s.update(1.1, after);
    expect(view.manId).toBeNull();
    expect(view.ignore.has('C')).toBe(true);
    expect(view.ignore.has('Y')).toBe(false);
  });

  it('a corner with nobody in its lane waits, then takes the first receiver who comes in, even late', () => {
    const { cb1 } = trackers();
    expect(cb1.update(2.5, [rec('Y', { x: 3, y: 9 }, { x: 0, y: 6 })]).manId).toBeNull();
    expect(cb1.update(3, [rec('H', { x: 7, y: 1 }, { x: 5, y: 0 })])).toMatchObject({
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
