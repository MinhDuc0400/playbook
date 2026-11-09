import { describe, expect, it } from 'vitest';
import { computeRuleLanes, cornerRules, insideRules } from '@/domain/areaRules';
import type { MatchRule, PlayerSlot, Point } from '@/domain/types';
import { createAreaCoordinator, type LaneMember } from '../areaCoordinator';
import type { PerceivedPlayer } from '../types';

let n = 0;
const idGen = () => `r${++n}`;

const def = (id: string, x: number, matchRules: MatchRule[]): PlayerSlot => ({
  id,
  role: 'CB',
  label: id,
  start: { x, y: 3.5 },
  actions: [],
  matchRules,
});

// Lanes: CB2 (x < −4.75), LB, S (1.25..6.5), CB1 (x ≥ 6.5) — the D-40 Bangkok alignment, as rules.
const slots = [
  def('CB2', -8, cornerRules(idGen)),
  def('LB', -1.5, insideRules(idGen, 'CB2')),
  def('S', 4, insideRules(idGen, 'CB1')),
  def('CB1', 9, cornerRules(idGen)),
];
const lanes = computeRuleLanes(slots)!;
const members: LaneMember[] = slots.map((s) => ({ id: s.id, rules: s.matchRules ?? [] }));

const rec = (id: string, pos: Point, vel: Point): PerceivedPlayer => ({
  id,
  side: 'offense',
  role: 'WR',
  pos,
  vel,
});

function coords(m: LaneMember[] = members) {
  const make = (selfId: string) =>
    createAreaCoordinator({ lanes, members: m, selfId, minX: -12.5, maxX: 12.5 });
  return { cb2: make('CB2'), lb: make('LB'), s: make('S'), cb1: make('CB1') };
}

describe('D-48 area coordinator (ports T-AM claim tracker)', () => {
  it('T-AM-01 Z out first goes to the corner, Y out second goes to S', () => {
    const { cb1, s } = coords();
    const frame = (z: Point, y: Point) => [rec('Z', z, { x: 6, y: 0 }), rec('Y', y, { x: 6, y: 0 })];
    expect(cb1.update(0.1, frame({ x: 6, y: 1 }, { x: 3, y: 1 })).fired).toBeNull();
    s.update(0.1, frame({ x: 6, y: 1 }, { x: 3, y: 1 }));
    // Z crosses into CB1's lane (x ≥ 6.5) at 0.3: the corner rule fires on that tick.
    const v1 = cb1.update(0.3, frame({ x: 7, y: 1 }, { x: 4, y: 1 }));
    expect(v1.manId).toBe('Z');
    expect(v1.fired).toMatchObject({ receiverId: 'Z' });
    expect(v1.fired?.rule.when.receiver).toEqual({ kind: 'nth', n: 1 });
    s.update(0.3, frame({ x: 7, y: 1 }, { x: 4, y: 1 }));
    expect(cb1.update(0.4, frame({ x: 7.5, y: 1 }, { x: 5, y: 1 })).manId).toBe('Z');
    s.update(0.4, frame({ x: 7.5, y: 1 }, { x: 5, y: 1 }));
    const view = s.update(0.6, frame({ x: 8, y: 1 }, { x: 6.8, y: 1 }));
    expect(view.manId).toBe('Y');
    expect(view.fired?.rule.when.receiver).toEqual({ kind: 'nth', n: 2 });
    expect(view.ignore.has('Z')).toBe(true);
  });

  it('a rule fires once: the next tick has no fired, the man stays', () => {
    const { cb1 } = coords();
    expect(cb1.update(0.2, [rec('Z', { x: 7, y: 1 }, { x: 5, y: 0 })]).fired).not.toBeNull();
    const again = cb1.update(0.3, [rec('Z', { x: 7.5, y: 1 }, { x: 5, y: 0 })]);
    expect(again.fired).toBeNull();
    expect(again.manId).toBe('Z');
  });

  it('T-AM-02 nobody out: the corner stays with no man however long it takes; S stays in zone', () => {
    const { cb1, s } = coords();
    const at = (t: number) => [
      rec('Z', { x: 5 - 4 * t, y: 1 + t }, { x: -5, y: 1 }),
      rec('Y', { x: 3, y: 0.5 + 6 * t }, { x: 0, y: 6 }),
    ];
    for (const t of [0.4, 0.5, 1, 2, 3]) {
      expect(cb1.update(t, at(t)).manId).toBeNull();
      const sv = s.update(t, at(t));
      expect(sv.manId).toBeNull();
      expect(sv.ignore.has('Y')).toBe(false);
    }
  });

  it('T-AM-07 a receiver breaking out into the corner lane is the corner first-in; S does not take him', () => {
    const { cb1, s } = coords();
    const before = [
      rec('Y', { x: 3, y: 3.5 }, { x: 0, y: 6 }),
      rec('C', { x: 3.3, y: 2.3 }, { x: 6.5, y: 1.8 }),
    ];
    expect(cb1.update(0.9, before).manId).toBeNull();
    s.update(0.9, before);
    const after = [
      rec('Y', { x: 3, y: 4.7 }, { x: 0, y: 6 }),
      rec('C', { x: 6.8, y: 2.6 }, { x: 6.5, y: 1.8 }),
    ];
    expect(cb1.update(1.1, after).manId).toBe('C');
    const view = s.update(1.1, after);
    expect(view.manId).toBeNull();
    expect(view.ignore.has('C')).toBe(true);
    expect(view.ignore.has('Y')).toBe(false);
  });

  it('a corner with nobody in its lane waits, then takes the first receiver who comes in, even late', () => {
    const { cb1 } = coords();
    expect(cb1.update(2.5, [rec('Y', { x: 3, y: 9 }, { x: 0, y: 6 })]).manId).toBeNull();
    expect(cb1.update(3, [rec('H', { x: 7, y: 1 }, { x: 5, y: 0 })]).manId).toBe('H');
  });

  it('ties go to the receiver nearer the sideline', () => {
    const { cb1, s } = coords();
    const seen = [rec('Y', { x: 8, y: 0.6 }, { x: 0, y: 5 }), rec('Z', { x: 12, y: 0.6 }, { x: 0, y: 5 })];
    expect(cb1.update(0.1, seen).manId).toBe('Z');
    expect(s.update(0.1, seen).manId).toBe('Y');
  });

  it('claims are sticky', () => {
    const { cb1 } = coords();
    cb1.update(0.2, [rec('Z', { x: 7, y: 1 }, { x: 5, y: 0 })]);
    expect(cb1.update(0.6, [rec('Z', { x: 4, y: 3 }, { x: -5, y: 0 })]).manId).toBe('Z');
  });

  it('nothing is logged before the snap', () => {
    const { cb1 } = coords();
    expect(cb1.update(-0.2, [rec('Z', { x: 8, y: -1 }, { x: 3, y: 0 })]).manId).toBeNull();
    expect(cb1.update(0, [rec('Z', { x: 8, y: -1 }, { x: 3, y: 0 })]).manId).toBeNull();
  });

  it('the left side mirrors: CB2 first, LB second', () => {
    const { cb2, lb } = coords();
    const seen = [rec('X', { x: -6, y: 1 }, { x: -6, y: 0 })];
    cb2.update(0.2, seen);
    lb.update(0.2, seen);
    const later = [rec('X', { x: -7, y: 1 }, { x: -6, y: 0 }), rec('C', { x: -5, y: 1 }, { x: -6, y: 0 })];
    expect(cb2.update(0.4, later).manId).toBe('X');
    expect(lb.update(0.4, later).manId).toBe('C');
  });

  it('an "any" area rule fires on the first receiver into the lane', () => {
    const any: MatchRule = {
      id: 'any1',
      priority: 0,
      when: { receiver: { kind: 'any' }, event: 'entersArea', area: { kind: 'self' } },
      then: { type: 'manTrigger' },
    };
    const m = members.map((x) => (x.id === 'CB1' ? { id: 'CB1', rules: [any] } : x));
    const { cb1 } = coords(m);
    expect(cb1.update(0.2, [rec('Z', { x: 7, y: 1 }, { x: 5, y: 0 })])).toMatchObject({
      manId: 'Z',
      fired: { receiverId: 'Z' },
    });
  });

  it('an inside rule naming a teammate who is not a lane member never fires', () => {
    const m = members.map((x) => (x.id === 'S' ? { id: 'S', rules: insideRules(idGen, 'GHOST') } : x));
    const { cb1, s } = coords(m);
    const seen = [rec('Z', { x: 7, y: 1 }, { x: 5, y: 0 }), rec('Y', { x: 8, y: 1 }, { x: 5, y: 0 })];
    cb1.update(0.2, seen);
    expect(s.update(0.2, seen).manId).toBeNull();
  });

  it('Final review: two members whose rules share an id (Ctrl+D copy) each still fire', () => {
    const shared = cornerRules(() => 'same');
    const m: LaneMember[] = [
      { id: 'A', rules: shared },
      { id: 'B', rules: shared },
    ];
    const two = computeRuleLanes([def('A', -6, shared), def('B', 6, shared)])!;
    const a = createAreaCoordinator({ lanes: two, members: m, selfId: 'A', minX: -12.5, maxX: 12.5 });
    const b = createAreaCoordinator({ lanes: two, members: m, selfId: 'B', minX: -12.5, maxX: 12.5 });
    const seen = [rec('X', { x: -8, y: 1 }, { x: -5, y: 0 }), rec('Y', { x: 8, y: 1 }, { x: 5, y: 0 })];
    expect(a.update(0.2, seen).manId).toBe('X');
    expect(b.update(0.2, seen).manId).toBe('Y');
  });

  describe('D-51 a defender with a zone: the zone outline is his area', () => {
    // The user's board: CB1 −11.5, FS −4 (moved 1.5 right of his quarter), SS 3.5, CB2 12; quarters as areas.
    const quarter = (x0: number, x1: number) => [
      { x: x0, y: 0 },
      { x: x1, y: 0 },
      { x: x1, y: 30 },
      { x: x0, y: 30 },
    ];
    const any = (id: string): MatchRule => ({
      id,
      priority: 0,
      when: { receiver: { kind: 'any' }, event: 'entersArea', area: { kind: 'self' } },
      then: { type: 'manTrigger' },
    });
    const board = [
      def('CB1', -11.5, [any('a')]),
      def('FS', -2.5, [any('b')]),
      def('SS', 3.5, []),
      def('CB2', 12, []),
    ];
    const lanesQ = computeRuleLanes(board)!;
    const m: LaneMember[] = [
      { id: 'CB1', rules: [any('a')], area: quarter(-15, -7.75) },
      { id: 'FS', rules: [any('b')], area: quarter(-6.25, 1.25) },
      { id: 'SS', rules: [], area: quarter(-0.25, 7.25) },
      { id: 'CB2', rules: [], area: quarter(7.25, 15) },
    ];
    const make = (selfId: string) =>
      createAreaCoordinator({ lanes: lanesQ, members: m, selfId, minX: -15, maxX: 15 });

    it("the gap between two zones is nobody's area, even though a midline lane covers it", () => {
      // Midline CB1 | FS is −7; CB1's zone ends at −7.75, FS's starts at −6.25.
      for (const x of [-7.5, -6.6]) {
        const seen = [rec('X', { x, y: 1 }, { x: 0, y: 5 })];
        expect(make('CB1').update(0.2, seen).manId).toBeNull();
        expect(make('FS').update(0.2, seen).manId).toBeNull();
      }
      expect(make('FS').update(0.2, [rec('X', { x: -6, y: 1 }, { x: 0, y: 5 })]).manId).toBe('X');
    });

    it('a receiver behind the LOS counts once he is level with a zone that starts at the LOS', () => {
      const seen = [rec('X', { x: -12, y: -1 }, { x: 0, y: 5 })];
      expect(make('CB1').update(0.2, seen).manId).toBe('X');
    });

    it('a zone that starts deep is not entered by a shallow receiver', () => {
      const deep: LaneMember[] = [
        {
          id: 'CB1',
          rules: [any('a')],
          area: [
            { x: -15, y: 10 },
            { x: -5, y: 10 },
            { x: -5, y: 30 },
            { x: -15, y: 30 },
          ],
        },
      ];
      const c = createAreaCoordinator({ lanes: lanesQ, members: deep, selfId: 'CB1', minX: -15, maxX: 15 });
      expect(c.update(0.2, [rec('X', { x: -12, y: 3 }, { x: 0, y: 5 })]).manId).toBeNull();
      expect(c.update(0.6, [rec('X', { x: -12, y: 11 }, { x: 0, y: 5 })]).manId).toBe('X');
    });
  });
});
