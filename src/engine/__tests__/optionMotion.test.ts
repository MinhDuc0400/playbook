import { describe, expect, it } from 'vitest';
import { DEFAULT_BALL_SPOT, createDefaultFields } from '@/domain/field';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Action, Frame, ID, Point, SimEvent } from '@/domain/types';
import { frameAt } from '../frames';
import { prepareSim } from '../prepare';
import { previewOffense } from '../preview';
import { simulate } from '../simulate';
import { cover3Play, makeInput, makePlay, qbSlot, slot, zoneSlot } from './fixtures';

const optionAction = (stem: Point[], vsMan: Point[], vsZone: Point[]): Action => ({
  type: 'option',
  stem,
  vsMan,
  vsZone,
  decideAtStemEnd: true,
});

const wrStart = { x: 6, y: -1 };
const optionOffense = () =>
  makePlay('offense', [
    qbSlot(),
    slot('w', 'WR', 'W', wrStart, [optionAction([{ x: 6, y: 4 }], [{ x: 0, y: 12 }], [{ x: 14, y: 12 }])]),
  ]);

const posAt = (frames: Frame[], id: ID, t: number): Point => {
  const f = frameAt(frames, t) as Frame;
  return (f.players[id] as { pos: Point }).pos;
};
const byType = (events: SimEvent[], type: SimEvent['type']): SimEvent[] =>
  events.filter((e) => e.type === type);

function manDefense() {
  return makePlay('defense', [
    slot('d', 'CB', 'D', { x: 6, y: 0 }, [
      { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail', cushion: 0 },
    ]),
  ]);
}
function zoneDefense() {
  return makePlay('defense', [
    zoneSlot('z', 'CB', 'Z', { x: 12, y: 6 }, 'deep-third-R', { x: 10, y: 15 }),
    zoneSlot('z2', 'LB', 'L', { x: 0, y: 5 }, 'hook-M', { x: 0, y: 6 }, 'head-up'),
  ]);
}

describe('T-ENG-04 option route branches vs man and zone', () => {
  it('chooses man against a trailing man defender and runs the vsMan (inside) branch', () => {
    const r = simulate(makeInput(optionOffense(), manDefense()));
    const choice = byType(r.events, 'optionChoice');
    expect(choice).toHaveLength(1);
    expect(choice[0]?.playerId).toBe('w');
    expect(choice[0]?.data).toEqual({ branch: 'man' });
    expect(posAt(r.frames, 'w', 1.6).x).toBeLessThan(wrStart.x - 1);
  });

  it('chooses zone against a zone defense and runs the vsZone (outside) branch', () => {
    const r = simulate(makeInput(optionOffense(), zoneDefense()));
    const choice = byType(r.events, 'optionChoice');
    expect(choice).toHaveLength(1);
    expect(choice[0]?.data).toEqual({ branch: 'zone' });
    expect(posAt(r.frames, 'w', 1.6).x).toBeGreaterThan(wrStart.x + 0.5);
  });

  it('is deterministic', () => {
    const a = simulate(makeInput(optionOffense(), manDefense(), { seed: 5 }));
    const b = simulate(makeInput(optionOffense(), manDefense(), { seed: 5 }));
    expect(b).toEqual(a);
  });

  it('offense-only preview takes the vsZone branch and reports the choice', () => {
    const r = previewOffense({
      play: optionOffense(),
      field: createDefaultFields()['5v5'],
      ballSpot: DEFAULT_BALL_SPOT,
      tuning: { ...DEFAULT_TUNING },
      duration: 4.5,
    });
    expect(byType(r.events, 'optionChoice')[0]?.data).toEqual({ branch: 'zone' });
    expect(posAt(r.frames, 'w', 4.5).x).toBeGreaterThan(wrStart.x + 1);
  });
});

describe('pre-snap motion (SRS §8.2.5)', () => {
  const dStart = { x: -5, y: -1 };
  const dEnd = { x: 5, y: -1 };
  const offense = (withMotion: boolean) =>
    makePlay('offense', [
      qbSlot(),
      slot('a', 'WR', 'A', { x: 10, y: -1 }),
      slot('b', 'WR', 'B', { x: -8, y: -1 }),
      slot('d', 'WR', 'D', dStart, [
        ...(withMotion ? ([{ type: 'motion', path: [dEnd], duration: 2 }] as Action[]) : []),
        { type: 'route', path: [{ x: 5, y: 10 }], endBehavior: 'stop' },
      ]),
    ]);
  const defense = makePlay('defense', [
    slot('m', 'CB', 'M', { x: 9, y: 5 }, [
      { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail', cushion: 0 },
    ]),
  ]);

  it('renumbers at the snap: the strong #1 binding follows the motion', () => {
    const still = prepareSim(makeInput(offense(false), defense));
    const moved = prepareSim(makeInput(offense(true), defense));
    expect(still.numbering.strongSide).toBe('left');
    expect(moved.numbering.strongSide).toBe('right');
    expect(still.bindings['m']).toMatchObject({ kind: 'man', targetId: 'b' });
    expect(moved.bindings['m']).toMatchObject({ kind: 'man', targetId: 'a' });
    expect(moved.motionDuration).toBe(2);
    expect(moved.plans['d']?.start).toEqual(dEnd);
  });

  it('simulate starts at t = −duration, ends the motion at t = 0 and then runs the route', () => {
    const r = simulate(makeInput(offense(true), defense));
    expect(r.frames[0]?.t).toBeCloseTo(-2, 1);
    expect(r.frames[0]?.t).toBeLessThanOrEqual(-2 + 1e-9 + 1 / 30);
    const p0 = posAt(r.frames, 'd', 0);
    expect(Math.hypot(p0.x - dEnd.x, p0.y - dEnd.y)).toBeLessThan(0.2);
    expect(posAt(r.frames, 'd', -1.9).x).toBeLessThan(dStart.x + 1);
    expect(posAt(r.frames, 'd', 2.5).y).toBeGreaterThan(4);
    expect(Math.abs(posAt(r.frames, 'd', 2.5).x - 5)).toBeLessThan(0.5);
    const motion = byType(r.events, 'motion');
    expect(motion).toHaveLength(1);
    expect(motion[0]?.t).toBeCloseTo(-2, 1);
    expect(byType(r.events, 'snap')[0]?.t).toBe(0);
    // Everybody else stands before the snap.
    const f = frameAt(r.frames, -1) as Frame;
    expect(f.players['a']?.pos).toEqual({ x: 10, y: -1 });
    expect(f.players['m']?.pos).toEqual({ x: 9, y: 5 });
    expect(frameAt(r.frames, -1)?.players['d']?.state).toBe('motion');
  });

  it('without motion the frames still start at 0', () => {
    const r = simulate(makeInput(offense(false), defense));
    expect(r.frames[0]?.t).toBe(0);
    expect(byType(r.events, 'motion')).toHaveLength(0);
  });

  it('preview runs the motion too', () => {
    const r = previewOffense({
      play: offense(true),
      field: createDefaultFields()['5v5'],
      ballSpot: DEFAULT_BALL_SPOT,
      tuning: { ...DEFAULT_TUNING },
      duration: 3,
    });
    expect(r.frames[0]?.t).toBeCloseTo(-2, 1);
    const p0 = posAt(r.frames, 'd', 0);
    expect(Math.hypot(p0.x - dEnd.x, p0.y - dEnd.y)).toBeLessThan(0.2);
    expect(posAt(r.frames, 'd', 3).y).toBeGreaterThan(4);
    expect(byType(r.events, 'motion')).toHaveLength(1);
    expect(r.frames[r.frames.length - 1]?.t).toBeCloseTo(3, 6);
  });

  it('a defense still works against a 5v5 play with motion (cover 3)', () => {
    const r = simulate(makeInput(offense(true), cover3Play()));
    expect(r.outcome).toBeDefined();
  });
});

describe('FR-OFF-09 route delay', () => {
  const play = makePlay('offense', [
    qbSlot(),
    slot('w', 'WR', 'W', { x: 6, y: -1 }, [
      { type: 'route', path: [{ x: 6, y: 12 }], endBehavior: 'stop', delay: 1 },
    ]),
  ]);

  it('stands still until t = 1 in the simulation', () => {
    const r = simulate(makeInput(play, zoneDefense()));
    expect(posAt(r.frames, 'w', 0.95)).toEqual({ x: 6, y: -1 });
    expect(posAt(r.frames, 'w', 2).y).toBeGreaterThan(0);
  });

  it('stands still until t = 1 in the preview', () => {
    const r = previewOffense({
      play,
      field: createDefaultFields()['5v5'],
      ballSpot: DEFAULT_BALL_SPOT,
      tuning: { ...DEFAULT_TUNING },
      duration: 3,
    });
    expect(posAt(r.frames, 'w', 0.95)).toEqual({ x: 6, y: -1 });
    expect(posAt(r.frames, 'w', 2).y).toBeGreaterThan(0);
  });

  it('prepare passes the delay to the plan', () => {
    expect(prepareSim(makeInput(play, zoneDefense())).plans['w']?.delay).toBe(1);
  });
});
