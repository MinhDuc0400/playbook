import { describe, expect, it } from 'vitest';
import { computeRuleLanes, cornerRules, insideRules, pairReadRules } from '@/domain/areaRules';
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

  it('T-AM-02 nobody out: the corner stays with no man however long it takes; S zones, then (D-53) takes the seam past 5 yd', () => {
    const { cb1, s } = coords();
    const at = (t: number) => [
      rec('Z', { x: 5 - 4 * t, y: 1 + t }, { x: -5, y: 1 }),
      rec('Y', { x: 3, y: 0.5 + 6 * t }, { x: 0, y: 6 }),
    ];
    for (const t of [0.4, 0.5, 1, 2, 3]) {
      expect(cb1.update(t, at(t)).manId).toBeNull();
      const sv = s.update(t, at(t));
      // Y is 2.9 / 3.5 yd deep at 0.4 / 0.5 s, 6.5 yd at 1 s; the drag Z never gets 5 yd deep.
      expect(sv.manId).toBe(t < 1 ? null : 'Y');
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

describe('D-53 leftover: "chưa ai nhận" past a depth', () => {
  // The user's quarter board: CB1 −11, FS −3.5, SS 4, CB2 11.5 (lanes, no zones here).
  const board = [
    def('CB1', -11, cornerRules(idGen)),
    def('FS', -3.5, insideRules(idGen, 'CB1')),
    def('SS', 4, insideRules(idGen, 'CB2')),
    def('CB2', 11.5, cornerRules(idGen)),
  ];
  const lanesB = computeRuleLanes(board)!;
  const membersB: LaneMember[] = board.map((s) => ({ id: s.id, rules: s.matchRules ?? [], at: s.start }));
  const make = (selfId: string) =>
    createAreaCoordinator({ lanes: lanesB, members: membersB, selfId, minX: -15, maxX: 15 });
  const up = { x: 0, y: 6 };
  /** Run all four coordinators over the same frames; return each one's last view. */
  function run(frames: [number, PerceivedPlayer[]][]) {
    const c = { CB1: make('CB1'), FS: make('FS'), SS: make('SS'), CB2: make('CB2') };
    const last: Record<string, ReturnType<typeof c.FS.update>> = {};
    for (const [t, seen] of frames) for (const [id, k] of Object.entries(c)) last[id] = k.update(t, seen);
    return last;
  }

  it('the inside template carries the leftover rule: any · chưa ai nhận · sâu ≥ 5 → Man người đó', () => {
    const rules = insideRules(idGen, 'CB1');
    expect(rules).toHaveLength(2);
    expect(rules[1]).toMatchObject({
      priority: 1,
      when: { receiver: { kind: 'any' }, event: 'unclaimed', minDepth: 5 },
      then: { type: 'manTrigger' },
    });
  });

  it('two verticals in the middle nobody took: FS takes the nearer Z, SS takes C, once they pass 5 yd', () => {
    const at = (y: number): PerceivedPlayer[] => [rec('C', { x: 0, y }, up), rec('Z', { x: -1.5, y }, up)];
    const shallow = run([
      [0.2, at(1)],
      [0.6, at(4.9)],
    ]);
    expect(shallow.FS!.manId).toBeNull();
    expect(shallow.SS!.manId).toBeNull();
    const deep = run([
      [0.2, at(1)],
      [0.6, at(4.9)],
      [0.8, at(5.2)],
    ]);
    expect(deep.FS!.manId).toBe('Z');
    expect(deep.SS!.manId).toBe('C');
    expect(deep.FS!.ignore.has('C')).toBe(true);
    expect(deep.SS!.fired?.rule.when.event).toBe('unclaimed');
  });

  it('a receiver a corner took is never a leftover; one leftover goes to the nearest only', () => {
    const v = run([
      [0.2, [rec('X', { x: 8, y: 1 }, { x: -6, y: 0 }), rec('C', { x: 0, y: 1 }, up)]],
      [0.4, [rec('X', { x: 7.6, y: 1 }, { x: -6, y: 0 }), rec('C', { x: 0, y: 3 }, up)]],
      [0.8, [rec('X', { x: 5, y: 1.5 }, { x: -6, y: 0 }), rec('C', { x: 0, y: 6 }, up)]],
    ]);
    // X starts in CB2's lane (x ≥ 7.75): CB2 has him.
    expect(v.CB2!.manId).toBe('X');
    // From the alignment spots (y 3.5), FS at −3.5 is nearer C (0, 6) than SS at 4: FS only.
    expect(v.FS!.manId).toBe('C');
    expect(v.SS!.manId).toBeNull();
  });

  it('the second one out still goes first: SS takes the second into CB2 lane, not the deep one', () => {
    const v = run([
      [0.2, [rec('Z', { x: 9, y: 1 }, { x: 6, y: 0 }), rec('Y', { x: 6, y: 1 }, { x: 6, y: 0 })]],
      [0.5, [rec('Z', { x: 10, y: 1 }, { x: 6, y: 0 }), rec('Y', { x: 8, y: 1.5 }, { x: 6, y: 0 })]],
      [1.0, [rec('Z', { x: 11, y: 1 }, { x: 6, y: 0 }), rec('Y', { x: 9, y: 6 }, up)]],
    ]);
    expect(v.CB2!.manId).toBe('Z');
    expect(v.SS!.manId).toBe('Y');
    expect(v.SS!.fired === null || v.SS!.fired.rule.when.event !== 'unclaimed').toBe(true);
  });
});

describe('D-54 "Đọc 2 người": LB reads người 1 (X) and người 2 (C) with CB2 beside him', () => {
  const X: MatchRule['when']['receiver'] = { kind: 'number', side: 'weak', number: 1 };
  const C: MatchRule['when']['receiver'] = { kind: 'role', role: 'C' };
  const board = [
    def('CB2', -8, cornerRules(idGen)),
    def('LB', -1.5, pairReadRules(idGen, X as never, C as never, 'CB2')),
    def('S', 4, insideRules(idGen, 'CB1')),
    def('CB1', 9, cornerRules(idGen)),
  ];
  const lanesP = computeRuleLanes(board)!;
  const membersP: LaneMember[] = board.map((s) => ({ id: s.id, rules: s.matchRules ?? [], at: s.start }));
  const resolveRef = (r: MatchRule['when']['receiver']) =>
    r.kind === 'role' ? r.role : r.kind === 'number' && r.side === 'weak' && r.number === 1 ? 'X' : null;
  const make = (selfId: string) =>
    createAreaCoordinator({
      lanes: lanesP,
      members: membersP,
      selfId,
      minX: -12.5,
      maxX: 12.5,
      resolveRef: resolveRef as never,
      strongSign: 1,
    });
  function run(frames: [number, PerceivedPlayer[]][]) {
    const c = { CB2: make('CB2'), LB: make('LB'), S: make('S'), CB1: make('CB1') };
    const last: Record<string, ReturnType<typeof c.LB.update>> = {};
    for (const [t, seen] of frames) for (const [id, k] of Object.entries(c)) last[id] = k.update(t, seen);
    return last;
  }
  const up = { x: 0, y: 6 };
  const still = { x: 0, y: 0 };

  it('the template rule: Khi [Người 1] [đọc 2 người với Người 2] (corner bên cạnh, sâu 5) thì Man người đó', () => {
    const [rule] = pairReadRules(() => 'p', X as never, C as never, 'CB2');
    expect(rule).toEqual({
      id: 'p',
      priority: 0,
      when: {
        receiver: X,
        event: 'pairRead',
        second: C,
        area: { kind: 'teammate', slotId: 'CB2' },
        minDepth: 5,
      },
      then: { type: 'manTrigger' },
    });
  });

  it('nothing read yet (both shallow, still running): LB has nobody', () => {
    const v = run([[0.2, [rec('X', { x: -4, y: 1 }, up), rec('C', { x: -1, y: 1 }, up)]]]);
    expect(v.LB!.manId).toBeNull();
  });

  it('1. người 1 out first: CB2 takes X, LB takes C', () => {
    const v = run([
      [0.2, [rec('X', { x: -4, y: 1 }, { x: -6, y: 0 }), rec('C', { x: -1, y: 1 }, up)]],
      [0.4, [rec('X', { x: -5.2, y: 1 }, { x: -6, y: 0 }), rec('C', { x: -1, y: 2 }, up)]],
    ]);
    expect(v.CB2!.manId).toBe('X');
    expect(v.LB!.manId).toBe('C');
    expect(v.LB!.fired?.rule.when.event).toBe('pairRead');
  });

  it('2. người 2 out first: CB2 takes C, LB takes X', () => {
    const v = run([
      [0.2, [rec('X', { x: -4, y: 1 }, up), rec('C', { x: -3, y: 1 }, { x: -6, y: 0 })]],
      [0.5, [rec('X', { x: -4, y: 3 }, up), rec('C', { x: -5.5, y: 1 }, { x: -6, y: 0 })]],
    ]);
    expect(v.CB2!.manId).toBe('C');
    expect(v.LB!.manId).toBe('X');
  });

  it('3. người 1 cuts inside: LB lets him go and takes C', () => {
    const v = run([
      [0.2, [rec('X', { x: -4, y: 1 }, up), rec('C', { x: -1, y: 1 }, up)]],
      [0.5, [rec('X', { x: -3, y: 2 }, { x: 6, y: 0.5 }), rec('C', { x: -1, y: 2.5 }, up)]],
    ]);
    expect(v.LB!.manId).toBe('C');
    expect(v.CB2!.manId).toBeNull();
  });

  it('4. both vertical past 5 yd: LB takes the deeper (C), CB2 takes the shallower (X) outside his lane', () => {
    const v = run([
      [0.2, [rec('X', { x: -4, y: 1 }, up), rec('C', { x: -1, y: 1.5 }, up)]],
      [0.6, [rec('X', { x: -4, y: 4 }, up), rec('C', { x: -1, y: 4.5 }, up)]],
      [0.8, [rec('X', { x: -4, y: 5.1 }, up), rec('C', { x: -1, y: 6 }, up)]],
    ]);
    expect(v.LB!.manId).toBe('C');
    expect(v.CB2!.manId).toBe('X');
    expect(v.CB2!.fired).toMatchObject({ receiverId: 'X' });
  });

  it('5. both stopped short of 5 yd: LB presses the nearer one (C)', () => {
    const v = run([
      [0.2, [rec('X', { x: -4, y: 1 }, up), rec('C', { x: -1, y: 1 }, up)]],
      [0.8, [rec('X', { x: -4, y: 3 }, still), rec('C', { x: -1, y: 3 }, still)]],
    ]);
    expect(v.LB!.manId).toBe('C');
    expect(v.CB2!.manId).toBeNull();
  });
});
