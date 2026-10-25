import { describe, expect, it } from 'vitest';
import {
  alignedPlayers,
  computeStrength,
  isBackfieldRb,
  isEligibleReceiver,
  isOnBall,
  numberReceivers,
  refForPlayer,
  resolveReceiverRef,
  sameRef,
  strongSideOf,
  type AlignedPlayer,
} from '../numbering';
import type { Play, ReceiverRef, Role } from '../types';

const p = (id: string, role: Role, x: number, y: number): AlignedPlayer => ({ id, role, pos: { x, y } });
const qb = () => p('Q', 'QB', 0, -5);
const c = () => p('C', 'C', 0, -0.5);
const wr = (id: string, x: number, y = -1) => p(id, 'WR', x, y);
const mirror = (ps: AlignedPlayer[]): AlignedPlayer[] =>
  ps.map((q) => ({ ...q, pos: { x: -q.pos.x, y: q.pos.y } }));

const trips = () => [qb(), c(), wr('A', 12), wr('B', 8), wr('D', 4.5)];
const twoByOne = () => [qb(), c(), wr('Z', 12), wr('Y', 7), wr('X', -12)];

describe('predicates', () => {
  it('isOnBall uses |x| < 0.25', () => {
    expect(isOnBall(p('a', 'C', 0.24, 0))).toBe(true);
    expect(isOnBall(p('a', 'C', -0.24, 0))).toBe(true);
    expect(isOnBall(p('a', 'WR', 0.25, 0))).toBe(false);
  });
  it('isBackfieldRb needs RB, |x| < 3, y < -2', () => {
    expect(isBackfieldRb(p('r', 'RB', 2.9, -3))).toBe(true);
    expect(isBackfieldRb(p('r', 'RB', 3, -3))).toBe(false);
    expect(isBackfieldRb(p('r', 'RB', 0, -2))).toBe(false);
    expect(isBackfieldRb(p('r', 'WR', 0, -5))).toBe(false);
  });
  it('isEligibleReceiver excludes QB, backfield RB and defense roles', () => {
    expect(isEligibleReceiver(qb())).toBe(false);
    expect(isEligibleReceiver(p('r', 'RB', 0.5, -5))).toBe(false);
    expect(isEligibleReceiver(p('r', 'RB', 10, -5))).toBe(true);
    expect(isEligibleReceiver(c())).toBe(true);
    expect(isEligibleReceiver(p('d', 'CB', 5, 1))).toBe(false);
  });
});

describe('T-DOM-04 strength', () => {
  it('trips right is right', () => {
    expect(computeStrength(trips())).toBe('right');
  });
  it('trips left is left', () => {
    expect(computeStrength(mirror(trips()))).toBe('left');
  });
  it('2x2 is balanced', () => {
    expect(computeStrength([qb(), c(), wr('a', -12), wr('b', -6), wr('d', 6), wr('e', 12)])).toBe('balanced');
  });
  it('bunch right is right', () => {
    expect(computeStrength([qb(), c(), wr('a', 6, -1), wr('b', 7, -2), wr('d', 7.5, -1)])).toBe('right');
  });
  it('stack left plus one right is left', () => {
    expect(computeStrength([qb(), c(), wr('a', -8, -1), wr('b', -8, -3), wr('d', 6)])).toBe('left');
  });
  it('spread with backfield RB is balanced (RB excluded)', () => {
    expect(computeStrength([qb(), c(), wr('a', -12), wr('b', 12), p('R', 'RB', 0.5, -5)])).toBe('balanced');
  });
  it('QB and C never counted', () => {
    expect(computeStrength([qb(), c()])).toBe('balanced');
    expect(computeStrength([qb(), c(), wr('a', 5)])).toBe('right');
  });
  it('a split-out RB counts, defense roles do not', () => {
    expect(computeStrength([qb(), p('r', 'RB', -10, -1), p('d', 'CB', 8, 1), p('e', 'S', 9, 7)])).toBe(
      'left',
    );
  });
});

describe('strongSideOf', () => {
  it('left / right strength is returned as is', () => {
    expect(strongSideOf(trips(), 'left')).toBe('left');
    expect(strongSideOf(trips(), 'right')).toBe('right');
  });
  it('balanced: wider side is strong', () => {
    const ps = [qb(), c(), wr('a', -6), wr('b', 12)];
    expect(strongSideOf(ps, 'balanced')).toBe('right');
    expect(strongSideOf(mirror(ps), 'balanced')).toBe('left');
  });
  it('balanced mirror with backfield RB on the left is left', () => {
    expect(strongSideOf([qb(), c(), wr('a', -10), wr('b', 10), p('R', 'RB', -1, -5)], 'balanced')).toBe(
      'left',
    );
  });
  it('balanced mirror with backfield RB on the right is right', () => {
    expect(strongSideOf([qb(), c(), wr('a', -10), wr('b', 10), p('R', 'RB', 1, -5)], 'balanced')).toBe(
      'right',
    );
  });
  it('perfect mirror with no RB or RB at x = 0 defaults to right', () => {
    expect(strongSideOf([qb(), c(), wr('a', -10), wr('b', 10)], 'balanced')).toBe('right');
    expect(strongSideOf([qb(), c(), wr('a', -10), wr('b', 10), p('R', 'RB', 0, -5)], 'balanced')).toBe(
      'right',
    );
  });
});

describe('T-DOM-05 numbering', () => {
  it('trips right: #1 x=12, #2 x=8, #3 x=4.5, C unnumbered, weak empty', () => {
    const n = numberReceivers(trips());
    expect(n.strength).toBe('right');
    expect(n.strongSide).toBe('right');
    expect(n.strong).toEqual(['A', 'B', 'D']);
    expect(n.weak).toEqual([]);
    expect(n.refs['A']).toEqual({ kind: 'number', side: 'strong', number: 1 });
    expect(n.refs['D']).toEqual({ kind: 'number', side: 'strong', number: 3 });
    expect(n.refs['C']).toBeUndefined();
    expect(n.qbId).toBe('Q');
    expect(n.cId).toBe('C');
    expect(n.rbId).toBeUndefined();
  });

  it('trips left numbers the left side as strong', () => {
    const n = numberReceivers(mirror(trips()));
    expect(n.strongSide).toBe('left');
    expect(n.strong).toEqual(['A', 'B', 'D']);
  });

  it('2x1 right: strong #1 Z, #2 Y, #3 C; weak #1 X', () => {
    const n = numberReceivers(twoByOne());
    expect(n.strong).toEqual(['Z', 'Y', 'C']);
    expect(n.weak).toEqual(['X']);
    expect(n.refs['C']).toEqual({ kind: 'number', side: 'strong', number: 3 });
    expect(n.refs['X']).toEqual({ kind: 'number', side: 'weak', number: 1 });
  });

  it('bunch: tied |x| are deterministic (deeper first, then id)', () => {
    const ps = [qb(), c(), wr('b', 7, -1), wr('a', 7, -1), wr('d', 7, -2), wr('e', 6)];
    const n = numberReceivers(ps);
    expect(n.strong).toEqual(['d', 'a', 'b']);
    expect(numberReceivers([...ps].reverse()).strong).toEqual(['d', 'a', 'b']);
  });

  it('stack: deeper player is first on equal |x|', () => {
    const n = numberReceivers([qb(), c(), wr('a', -8, -1), wr('b', -8, -3), wr('d', 6)]);
    expect(n.strongSide).toBe('left');
    expect(n.strong).toEqual(['b', 'a', 'C']);
    expect(n.weak).toEqual(['d']);
  });

  it('spread with backfield RB: RB is never numbered, rbId set', () => {
    const n = numberReceivers([qb(), c(), wr('a', -12), wr('b', 12), p('R', 'RB', 0.5, -5)]);
    expect(n.strength).toBe('balanced');
    expect(n.strongSide).toBe('right');
    expect(n.strong).toEqual(['b', 'C']);
    expect(n.weak).toEqual(['a']);
    expect(n.refs['R']).toBeUndefined();
    expect(n.rbId).toBe('R');
  });

  it('a split-out RB is numbered like a receiver', () => {
    const n = numberReceivers([qb(), c(), p('R', 'RB', 10, -1), wr('a', 4)]);
    expect(n.strong).toEqual(['R', 'a', 'C']);
    expect(n.rbId).toBeUndefined();
  });

  it('keeps at most 3 per side, extras unnumbered', () => {
    const n = numberReceivers([qb(), c(), wr('a', 14), wr('b', 12), wr('d', 10), wr('e', 8), wr('f', -5)]);
    expect(n.strong).toEqual(['a', 'b', 'd']);
    expect(n.refs['e']).toBeUndefined();
    expect(n.refs['C']).toBeUndefined();
  });

  it('uses the passed strength override', () => {
    const n = numberReceivers(twoByOne(), 'left');
    expect(n.strength).toBe('left');
    expect(n.strongSide).toBe('left');
    expect(n.strong).toEqual(['X', 'C']);
    expect(n.weak).toEqual(['Z', 'Y']);
  });

  it('ignores defense players', () => {
    const n = numberReceivers([...trips(), p('d1', 'CB', 12, 1), p('d2', 'S', -8, 7)]);
    expect(n.strong).toEqual(['A', 'B', 'D']);
    expect(n.weak).toEqual([]);
  });
});

describe('resolveReceiverRef / refForPlayer / sameRef', () => {
  const players = [...twoByOne(), p('R', 'RB', 0.5, -5)];
  const n = numberReceivers(players);

  it('resolves number refs', () => {
    expect(resolveReceiverRef({ kind: 'number', side: 'strong', number: 1 }, n)).toBe('Z');
    expect(resolveReceiverRef({ kind: 'number', side: 'strong', number: 3 }, n)).toBe('C');
    expect(resolveReceiverRef({ kind: 'number', side: 'weak', number: 1 }, n)).toBe('X');
  });
  it('returns null for a missing number', () => {
    expect(resolveReceiverRef({ kind: 'number', side: 'weak', number: 2 }, n)).toBeNull();
    const noC = numberReceivers([qb(), wr('a', 12), wr('b', 8)]);
    expect(resolveReceiverRef({ kind: 'number', side: 'strong', number: 3 }, noC)).toBeNull();
  });
  it('resolves role refs', () => {
    expect(resolveReceiverRef({ kind: 'role', role: 'QB' }, n)).toBe('Q');
    expect(resolveReceiverRef({ kind: 'role', role: 'C' }, n)).toBe('C');
    expect(resolveReceiverRef({ kind: 'role', role: 'RB' }, n)).toBe('R');
  });
  it('returns null for a role that is absent', () => {
    expect(resolveReceiverRef({ kind: 'role', role: 'RB' }, numberReceivers(trips()))).toBeNull();
    expect(resolveReceiverRef({ kind: 'role', role: 'QB' }, numberReceivers([c(), wr('a', 5)]))).toBeNull();
  });

  it('refForPlayer gives number refs, then role refs, else null', () => {
    expect(refForPlayer('Z', n, players)).toEqual({ kind: 'number', side: 'strong', number: 1 });
    expect(refForPlayer('Q', n, players)).toEqual({ kind: 'role', role: 'QB' });
    expect(refForPlayer('R', n, players)).toEqual({ kind: 'role', role: 'RB' });
    expect(refForPlayer('nope', n, players)).toBeNull();
    const many = [qb(), c(), wr('a', 14), wr('b', 12), wr('d', 10), wr('e', 8)];
    const nm = numberReceivers(many);
    expect(refForPlayer('e', nm, many)).toBeNull();
    expect(refForPlayer('C', nm, many)).toEqual({ kind: 'role', role: 'C' });
  });

  it('sameRef compares structurally', () => {
    const a: ReceiverRef = { kind: 'number', side: 'strong', number: 1 };
    expect(sameRef(a, { kind: 'number', side: 'strong', number: 1 })).toBe(true);
    expect(sameRef(a, { kind: 'number', side: 'weak', number: 1 })).toBe(false);
    expect(sameRef(a, { kind: 'number', side: 'strong', number: 2 })).toBe(false);
    expect(sameRef({ kind: 'role', role: 'RB' }, { kind: 'role', role: 'RB' })).toBe(true);
    expect(sameRef({ kind: 'role', role: 'RB' }, { kind: 'role', role: 'QB' })).toBe(false);
    expect(sameRef(a, { kind: 'role', role: 'QB' })).toBe(false);
  });
});

describe('alignedPlayers', () => {
  it('maps slot start positions', () => {
    const play = {
      id: 'p1',
      players: [
        { id: 's1', role: 'QB', label: 'Q', start: { x: 0, y: -5 }, actions: [] },
        { id: 's2', role: 'WR', label: 'X', start: { x: -10, y: -1 }, actions: [] },
      ],
    } as unknown as Play;
    expect(alignedPlayers(play)).toEqual([
      { id: 's1', role: 'QB', pos: { x: 0, y: -5 } },
      { id: 's2', role: 'WR', pos: { x: -10, y: -1 } },
    ]);
  });
});

describe('flip invariance', () => {
  const formations: Record<string, AlignedPlayer[]> = {
    'trips + RB': [...trips(), wr('W', -10), p('R', 'RB', 1, -5)],
    '2x1': twoByOne(),
    stack: [qb(), c(), wr('a', -8, -1), wr('b', -8, -3), wr('d', 6)],
    'wider right balanced': [qb(), c(), wr('a', -6), wr('b', 12)],
  };
  const refs: ReceiverRef[] = [
    ...(['strong', 'weak'] as const).flatMap((side) =>
      ([1, 2, 3] as const).map((number) => ({ kind: 'number', side, number }) as const),
    ),
    { kind: 'role', role: 'QB' },
    { kind: 'role', role: 'C' },
    { kind: 'role', role: 'RB' },
  ];

  for (const [name, ps] of Object.entries(formations)) {
    it(`mirroring ${name} binds every ref to the same slot`, () => {
      const strength = computeStrength(ps);
      const flipped = computeStrength(mirror(ps));
      const expected = strength === 'left' ? 'right' : strength === 'right' ? 'left' : 'balanced';
      expect(flipped).toBe(expected);
      const a = numberReceivers(ps, strength);
      const b = numberReceivers(mirror(ps), flipped);
      for (const ref of refs) {
        expect(resolveReceiverRef(ref, b)).toBe(resolveReceiverRef(ref, a));
      }
    });
  }
});
