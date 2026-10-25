import { describe, expect, it } from 'vitest';
import { defaultGhostFormation } from '@/domain/formations';
import type { AlignedPlayer } from '@/domain/numbering';
import {
  SCHEMA_VERSION,
  type Leverage,
  type Play,
  type PlayerSlot,
  type Point,
  type ReceiverRef,
} from '@/domain/types';
import { ALIGN_LEVERAGE_OFFSET, DEFAULT_CUSHION, TRAIL_DEPTH, autoAlign } from '../align';

/** 5v5 '2x1' ghost: Q (0,-5), C (0,-0.5), X (-12,-1), Y (7,-1), Z (12,-1). Strong = right: Z #1, Y #2, C #3. */
const ghost: AlignedPlayer[] = defaultGhostFormation('5v5').players.map((p) => ({
  id: p.label,
  role: p.role,
  pos: p.start,
}));

function man(
  id: string,
  target: ReceiverRef,
  opts: { leverage?: Leverage; technique?: 'trail' | 'cushion'; cushion?: number; start?: Point } = {},
): PlayerSlot {
  const s: PlayerSlot = {
    id,
    role: 'CB',
    label: id,
    start: opts.start ?? { x: 0, y: 20 },
    actions: [
      {
        type: 'man',
        target,
        technique: opts.technique ?? 'trail',
        ...(opts.cushion !== undefined ? { cushion: opts.cushion } : {}),
      },
    ],
  };
  if (opts.leverage) s.leverage = opts.leverage;
  return s;
}

function play(players: PlayerSlot[]): Play {
  return Object.freeze({
    id: 'd',
    schemaVersion: SCHEMA_VERSION,
    name: 'D',
    side: 'defense',
    format: '5v5',
    formation: 'Man',
    strength: 'right',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players,
  }) as Play;
}

const strong = (n: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side: 'strong', number: n });
const weak = (n: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side: 'weak', number: n });
const start = (p: Play, id: string): Point => (p.players.find((s) => s.id === id) as PlayerSlot).start;

describe('autoAlign (FR-DEF-05)', () => {
  it('constants', () => {
    expect([ALIGN_LEVERAGE_OFFSET, TRAIL_DEPTH, DEFAULT_CUSHION]).toEqual([1, 1, 5]);
  });

  it('strong #1 inside with cushion 5 → toward the ball, 5 yd off', () => {
    const next = autoAlign(
      play([man('a', strong(1), { leverage: 'inside', technique: 'cushion', cushion: 5 })]),
      ghost,
    );
    expect(start(next, 'a')).toEqual({ x: 11, y: 4 });
  });

  it('outside trail → away from the ball, depth 1 off the receiver, floored at 0.5', () => {
    const next = autoAlign(play([man('a', strong(1), { leverage: 'outside' })]), ghost);
    expect(start(next, 'a')).toEqual({ x: 13, y: 0.5 });
  });

  it('cushion without a value uses the default cushion', () => {
    const next = autoAlign(play([man('a', strong(1), { technique: 'cushion' })]), ghost);
    expect(start(next, 'a')).toEqual({ x: 12, y: 4 });
  });

  it('weak #1 inside mirrors toward the ball; outside goes to the sideline', () => {
    const next = autoAlign(
      play([
        man('in', weak(1), { leverage: 'inside', technique: 'cushion', cushion: 3 }),
        man('out', weak(1), { leverage: 'outside', technique: 'cushion', cushion: 3 }),
      ]),
      ghost,
    );
    expect(start(next, 'in')).toEqual({ x: -11, y: 2 });
    expect(start(next, 'out')).toEqual({ x: -13, y: 2 });
  });

  it('head-up and no leverage → x equals the target x', () => {
    const next = autoAlign(
      play([
        man('h', strong(2), { leverage: 'head-up', technique: 'cushion', cushion: 2 }),
        man('n', strong(2), { technique: 'cushion', cushion: 2 }),
      ]),
      ghost,
    );
    expect(start(next, 'h')).toEqual({ x: 7, y: 1 });
    expect(start(next, 'n')).toEqual({ x: 7, y: 1 });
  });

  it('strong #3 (the C on the ball) gets no lateral offset for any leverage', () => {
    for (const lv of ['inside', 'outside', 'head-up'] as const) {
      const next = autoAlign(play([man('a', strong(3), { leverage: lv })]), ghost);
      expect(start(next, 'a')).toEqual({ x: 0, y: 0.5 });
    }
  });

  it('role refs bind (QB)', () => {
    const next = autoAlign(
      play([man('a', { kind: 'role', role: 'QB' }, { technique: 'cushion', cushion: 4 })]),
      ghost,
    );
    expect(start(next, 'a')).toEqual({ x: 0, y: 0.5 });
  });

  it('numbering follows the ghost strength (flipped ghost swaps strong/weak sides)', () => {
    const flipped = ghost.map((g) => ({ ...g, pos: { x: -g.pos.x, y: g.pos.y } }));
    const next = autoAlign(
      play([man('a', strong(1), { leverage: 'inside', technique: 'cushion', cushion: 5 })]),
      flipped,
    );
    expect(start(next, 'a')).toEqual({ x: -11, y: 4 });
  });

  it('zone defenders and rushers are untouched', () => {
    const zone: PlayerSlot = {
      id: 'z',
      role: 'S',
      label: 'z',
      start: { x: 3, y: 12 },
      actions: [{ type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 14 } }],
    };
    const rusher: PlayerSlot = {
      id: 'r',
      role: 'R',
      label: 'r',
      start: { x: 1, y: 7 },
      actions: [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }],
    };
    const p = play([zone, rusher, man('a', strong(1))]);
    const next = autoAlign(p, ghost);
    expect(next.players[0]).toBe(zone);
    expect(next.players[1]).toBe(rusher);
    expect(next.players[2]).not.toBe(p.players[2]);
  });

  it('unresolved refs are skipped', () => {
    const p = play([man('a', weak(3), { start: { x: 5, y: 9 } })]);
    expect(autoAlign(p, ghost)).toBe(p);
  });

  it('slotIds restricts which defenders move', () => {
    const p = play([man('a', strong(1)), man('b', weak(1))]);
    const next = autoAlign(p, ghost, ['b']);
    expect(next.players[0]).toBe(p.players[0]);
    expect(start(next, 'b')).toEqual({ x: -12, y: 0.5 });
    expect(autoAlign(p, ghost, [])).toBe(p);
  });

  it('returns the same object when nothing moves; leaves updatedAt alone', () => {
    const p = play([man('a', strong(1), { leverage: 'outside' })]);
    const once = autoAlign(p, ghost);
    expect(once.updatedAt).toBe(p.updatedAt);
    expect(autoAlign(once, ghost)).toBe(once);
  });
});
