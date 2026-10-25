import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_BALL_SPOT, createDefaultFields, sidelineBounds } from '@/domain/field';
import { buildRoute } from '@/domain/routeTree';
import { SCHEMA_VERSION } from '@/domain/types';
import type { Action, Play, PlayerSlot, Point, Role } from '@/domain/types';
import { previewOffense } from '../preview';

const field = createDefaultFields()['5v5'];
const ballSpot = DEFAULT_BALL_SPOT;
const bounds = sidelineBounds(field, ballSpot);

function slot(id: string, role: Role, start: Point, actions: Action[] = []): PlayerSlot {
  return { id, role, label: id, start, actions };
}

function playOf(players: PlayerSlot[]): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'balanced',
    players,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const qbStart = { x: 0, y: -5 };
const hitchStart = { x: -6, y: 0 };
const outStart = { x: 12, y: 0 };
const slantStart = { x: 8, y: 0 };

const play = playOf([
  slot('qb', 'QB', qbStart, [{ type: 'qbDrop', depth: 3, style: 'shotgun' }]),
  slot('c', 'C', { x: 0, y: 0 }),
  slot('hitch', 'WR', hitchStart, [buildRoute('hitch', hitchStart, { depth: 5 })]),
  slot('out', 'WR', outStart, [buildRoute('out', outStart, { depth: 5 })]),
  slot('slant', 'WR', slantStart, [buildRoute('slant', slantStart)]),
]);

const run = (p: Play = play, duration?: number) =>
  previewOffense({ play: p, field, ballSpot, tuning: DEFAULT_TUNING, duration });

describe('previewOffense (FR-OFF-06, D-13)', () => {
  it('is deterministic (NFR-ARC-02)', () => {
    expect(run()).toEqual(run());
  });

  it('samples frames at exactly k/30 from 0 to duration inclusive', () => {
    const r = run(play, 4);
    expect(r.duration).toBe(4);
    expect(r.frames).toHaveLength(121);
    r.frames.forEach((f, k) => expect(f.t).toBe(k / 30));
    const short = run(play, 1.5);
    expect(short.frames).toHaveLength(46);
    expect(short.frames[45]!.t).toBe(45 / 30);
  });

  it('defaults to 4 s', () => {
    expect(run().duration).toBe(4);
    expect(run().frames[run().frames.length - 1]!.t).toBe(4);
  });

  it('first frame is the formation at rest', () => {
    const f0 = run().frames[0]!;
    expect(f0.players['qb']).toEqual({ pos: qbStart, vel: { x: 0, y: 0 }, state: 'drop' });
    expect(f0.players['c']!.state).toBe('idle');
    expect(f0.players['hitch']!.state).toBe('route');
    expect(f0.players['hitch']!.pos).toEqual(hitchStart);
  });

  it('QB backpedals to y = start.y − depth and stands', () => {
    const r = run();
    const last = r.frames[r.frames.length - 1]!.players['qb']!;
    expect(Math.abs(last.pos.y - (qbStart.y - 3))).toBeLessThanOrEqual(0.1);
    expect(last.pos.x).toBeCloseTo(qbStart.x, 9);
    expect(Math.hypot(last.vel.x, last.vel.y)).toBe(0);
    // Backpedal speed never exceeds 0.7 × max.
    for (const f of r.frames)
      expect(Math.hypot(f.players['qb']!.vel.x, f.players['qb']!.vel.y)).toBeLessThanOrEqual(0.7 * 7 + 1e-9);
  });

  it('a hitch receiver ends near its last point and stands', () => {
    const r = run();
    const route = play.players.find((p) => p.id === 'hitch')!.actions[0] as { path: Point[] };
    const end = route.path[route.path.length - 1]!;
    const last = r.frames[r.frames.length - 1]!.players['hitch']!;
    expect(Math.hypot(last.pos.x - end.x, last.pos.y - end.y)).toBeLessThan(0.3);
    expect(Math.hypot(last.vel.x, last.vel.y)).toBe(0);
  });

  it("an 'out' receiver stops at the sideline, never beyond", () => {
    const r = run();
    const last = r.frames[r.frames.length - 1]!.players['out']!;
    expect(last.pos.x).toBeCloseTo(bounds.maxX, 9);
    expect(last.pos.x).toBeLessThanOrEqual(bounds.maxX);
    expect(Math.hypot(last.vel.x, last.vel.y)).toBe(0);
  });

  it('keeps every player within the sidelines in every frame', () => {
    for (const f of run().frames) {
      for (const p of Object.values(f.players)) {
        expect(p.pos.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(p.pos.x).toBeLessThanOrEqual(bounds.maxX);
      }
    }
  });

  it("emits one 'snap' at 0 and a 'break' per sharp break reached", () => {
    const { events } = run();
    expect(events.filter((e) => e.type === 'snap')).toEqual([{ t: 0, type: 'snap' }]);
    const breaks = events.filter((e) => e.type === 'break');
    // hitch, out and slant each have one sharp break (index 0); the last point never counts.
    const byPlayer = (id: string) => breaks.filter((e) => e.playerId === id);
    expect(byPlayer('hitch')).toHaveLength(1);
    expect(byPlayer('out')).toHaveLength(1);
    expect(byPlayer('slant')).toHaveLength(1);
    expect(byPlayer('qb')).toHaveLength(0);
    expect(byPlayer('c')).toHaveLength(0);
    for (const e of breaks) {
      expect(e.t).toBeGreaterThan(0);
      expect(e.data).toEqual({ index: 0 });
    }
  });

  it('a delayed route keeps the receiver still until the delay passes', () => {
    const delayed = playOf([slot('wr', 'WR', slantStart, [{ ...buildRoute('go', slantStart), delay: 1 }])]);
    const frames = run(delayed, 2).frames;
    for (const f of frames.filter((x) => x.t < 1 - 1e-9)) expect(f.players['wr']!.pos).toEqual(slantStart);
    expect(frames[frames.length - 1]!.players['wr']!.pos.y).toBeGreaterThan(slantStart.y + 3);
  });

  it('ball is held by the QB and follows him', () => {
    const r = run();
    for (const f of r.frames) {
      expect(f.ball.state).toBe('held');
      expect(f.ball.carrierId).toBe('qb');
      expect(f.ball.pos).toEqual(f.players['qb']!.pos);
    }
  });

  it('without a QB the ball is held at the origin', () => {
    const noQb = playOf([slot('wr', 'WR', slantStart, [buildRoute('go', slantStart)])]);
    expect(run(noQb, 1).frames[0]!.ball).toEqual({ state: 'held', pos: { x: 0, y: 0 } });
  });

  it('uses given stats (faster receiver travels farther) and avg preset otherwise', () => {
    const wr = playOf([slot('wr', 'WR', { x: 0, y: 0 }, [buildRoute('go', { x: 0, y: 0 }, { depth: 40 })])]);
    const base = run(wr, 2).frames.at(-1)!.players['wr']!.pos.y;
    const fast = previewOffense({
      play: wr,
      field,
      ballSpot,
      tuning: DEFAULT_TUNING,
      duration: 2,
      stats: {
        wr: {
          speed: 8,
          accel: 0.6,
          cutLoss: 0.2,
          reaction: 0.2,
          iq: 0.8,
          hands: 0.9,
          ballSkills: 0.5,
          release: 0.3,
          accuracy: 0.9,
          armRange: 40,
          eyeDiscipline: 0.8,
        },
      },
    });
    expect(fast.frames.at(-1)!.players['wr']!.pos.y).toBeGreaterThan(base + 1);
  });

  it('pushes overlapping teammates apart (D-10) but only after t = 0', () => {
    const overlap = playOf([slot('a', 'WR', { x: 0, y: 0 }), slot('b', 'WR', { x: 0.1, y: 0 })]);
    const frames = run(overlap, 1).frames;
    expect(frames[0]!.players['b']!.pos).toEqual({ x: 0.1, y: 0 });
    const end = frames.at(-1)!.players;
    expect(
      Math.hypot(end['a']!.pos.x - end['b']!.pos.x, end['a']!.pos.y - end['b']!.pos.y),
    ).toBeGreaterThanOrEqual(0.5 - 1e-9);
  });

  it('samples correctly for a different simDt', () => {
    const r = previewOffense({
      play,
      field,
      ballSpot,
      tuning: { ...DEFAULT_TUNING, simDt: 1 / 50 },
      duration: 2,
    });
    expect(r.frames).toHaveLength(61);
    r.frames.forEach((f, k) => expect(f.t).toBe(k / 30));
  });

  it('does not mutate the input play', () => {
    const copy = structuredClone(play);
    run();
    expect(play).toEqual(copy);
  });
});
