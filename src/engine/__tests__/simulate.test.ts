import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { sidelineBounds } from '@/domain/field';
import { zonePreset } from '@/domain/zones';
import type { Frame, ID, Point, RouteAction, SimResult } from '@/domain/types';
import { distance } from '@/domain/geometry';
import { simulate, POST_OUTCOME_TIME } from '../simulate';
import { cover3Play, floodPlay, makeInput, makePlay, qbSlot, rusherSlot, slot, wrSlot } from './fixtures';

function sepAt(r: SimResult, id: ID, t: number): number {
  const series = r.metrics.separation[id] ?? [];
  let best = series[0];
  for (const s of series) if (best === undefined || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  return best?.d ?? NaN;
}

function throwTime(r: SimResult): number | undefined {
  return r.events.find((e) => e.type === 'throw')?.t;
}

describe('simulate basics', () => {
  const input = makeInput(floodPlay(), cover3Play(), { noise: true, seed: 7 });
  const res = simulate(input);
  const { minX, maxX } = sidelineBounds(input.field, input.ballSpot);

  it('frames are sampled at k/30 from 0 and events start with snap', () => {
    res.frames.forEach((f, k) => expect(f.t).toBeCloseTo(k / 30, 9));
    expect(res.frames[0]?.t).toBe(0);
    expect(res.events[0]).toEqual({ t: 0, type: 'snap' });
  });

  it('sets an outcome and stops POST_OUTCOME_TIME after it, within maxTime', () => {
    const last = res.frames[res.frames.length - 1] as Frame;
    expect(last.t).toBeLessThanOrEqual(input.tuning.maxTime + 1 / 30);
    expect(last.t).toBeGreaterThanOrEqual(res.outcome.t + POST_OUTCOME_TIME - 1 / 30);
    expect(last.t).toBeLessThanOrEqual(res.outcome.t + POST_OUTCOME_TIME + 1 / 30);
  });

  it('keeps everybody inside the sidelines, the QB behind the LOS, defenders behind it until the throw', () => {
    const tThrow = throwTime(res) ?? res.outcome.t;
    for (const f of res.frames) {
      for (const [id, p] of Object.entries(f.players)) {
        expect(p.pos.x).toBeGreaterThanOrEqual(minX - 1e-9);
        expect(p.pos.x).toBeLessThanOrEqual(maxX + 1e-9);
        if (id === 'f-q') expect(p.pos.y).toBeLessThanOrEqual(1e-9);
        if (id.startsWith('c-') && id !== 'c-r1' && f.t <= tThrow) {
          expect(p.pos.y).toBeGreaterThanOrEqual(-1e-9);
        }
      }
    }
  });

  it('complete outcome yards equal the landing depth; ball ends dead', () => {
    let found = 0;
    for (let seed = 1; seed <= 30 && found < 3; seed++) {
      const r = simulate(makeInput(floodPlay(), cover3Play(), { noise: true, seed }));
      const lastBall = (r.frames[r.frames.length - 1] as Frame).ball;
      expect(lastBall.state).toBe('dead');
      if (r.outcome.kind === 'complete') {
        found += 1;
        expect(r.outcome.yards).toBeCloseTo((lastBall.landing as Point).y, 9);
        expect(r.events.some((e) => e.type === 'catch')).toBe(true);
        expect(r.metrics.timeToThrow).toBeDefined();
        expect(Object.keys(r.metrics.separationAtThrow ?? {}).length).toBe(4);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('ball is held at the QB before the throw and in the air after it', () => {
    const tThrow = throwTime(res);
    expect(tThrow).toBeDefined();
    const before = res.frames.filter((f) => f.t < (tThrow as number) - 1e-9);
    for (const f of before) {
      expect(f.ball.state).toBe('held');
      expect(f.ball.pos).toEqual(f.players['f-q']?.pos);
    }
    const air = res.frames.find((f) => f.ball.state === 'inAir');
    expect(air).toBeDefined();
  });

  it('timeout: held ball at maxTime ends the play', () => {
    const off = makePlay('offense', [qbSlot(), wrSlot('a', 'A', -8, null)]);
    const def = makePlay('defense', [
      slot('d', 'CB', 'CB1', { x: -8, y: 3 }, [
        { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' },
      ]),
    ]);
    const r = simulate(makeInput(off, def, { tuning: { ...makeInput(off, def).tuning, maxTime: 2 } }));
    expect(r.outcome.kind).toBe('timeout');
    expect(r.outcome.t).toBeCloseTo(2, 6);
  });
});

describe('T-ENG-01 deterministic', () => {
  it('same input and seed gives identical frames and events', () => {
    const a = simulate(makeInput(floodPlay(), cover3Play(), { noise: true, seed: 42 }));
    const b = simulate(makeInput(floodPlay(), cover3Play(), { noise: true, seed: 42 }));
    expect(b.frames).toEqual(a.frames);
    expect(b.events).toEqual(a.events);
    expect(b.outcome).toEqual(a.outcome);
  });

  it('different seeds with noise differ', () => {
    const a = simulate(makeInput(floodPlay(), cover3Play(), { noise: true, seed: 1 }));
    const b = simulate(makeInput(floodPlay(), cover3Play(), { noise: true, seed: 2 }));
    expect(b.frames).not.toEqual(a.frames);
  });
});

describe('T-ENG-02 no lookahead', () => {
  function offenseWith(laterPath: Point[]) {
    const aRoute: RouteAction = {
      type: 'route',
      path: [{ x: -10, y: 4 }, ...laterPath],
      smooth: [false, ...laterPath.map(() => false)],
      endBehavior: 'continue',
    };
    const a = slot('a', 'WR', 'A', { x: -10, y: -1 }, [aRoute]);
    const b = wrSlot('b', 'B', 10, null);
    return makePlay('offense', [qbSlot(), a, b], ['b', 'a']);
  }
  const defense = makePlay('defense', [
    slot(
      'cb',
      'CB',
      'CB1',
      { x: -10, y: 5 },
      [{ type: 'man', target: { kind: 'number', side: 'weak', number: 1 }, technique: 'trail' }],
      'inside',
    ),
    slot(
      's',
      'S',
      'FS',
      { x: 0, y: 11 },
      [{ type: 'zone', zone: 'deep-middle', dropPoint: { x: 0, y: 15 } }],
      'head-up',
    ),
    slot(
      'lb',
      'LB',
      'LB',
      { x: 3, y: 5 },
      [{ type: 'zone', zone: 'hook-M', dropPoint: { x: 0, y: 6 } }],
      'head-up',
    ),
  ]);

  it.each([0, 0.5])(
    'defenders are identical before the first offensive difference + the minimum effective delay (a = %s)',
    (a) => {
      const runA = simulate(makeInput(offenseWith([{ x: -10, y: 15 }]), defense, { anticipation: a }));
      const runB = simulate(makeInput(offenseWith([{ x: -2, y: 10 }]), defense, { anticipation: a }));
      const offenseIds = ['q', 'a', 'b'];
      const defenderIds = ['cb', 'cb2', 's', 'lb'];

      const n = Math.min(runA.frames.length, runB.frames.length);
      let diffIdx = -1;
      for (let k = 0; k < n && diffIdx < 0; k++) {
        for (const id of offenseIds) {
          const pa = (runA.frames[k] as Frame).players[id];
          const pb = (runB.frames[k] as Frame).players[id];
          if (pa?.pos.x !== pb?.pos.x || pa?.pos.y !== pb?.pos.y) diffIdx = k;
        }
      }
      expect(diffIdx).toBeGreaterThan(0);
      const tDiff = (runA.frames[diffIdx] as Frame).t;

      const tuning = makeInput(offenseWith([]), defense).tuning;
      const minDelay = DEFAULT_PRESETS.avg.reaction * tuning.leverageReactionFactor * 0.5;
      // The QB must not have thrown before the change is visible (this test is about the defense's eyes).
      for (const r of [runA, runB]) {
        const tt = throwTime(r);
        if (tt !== undefined) expect(tt).toBeGreaterThan(tDiff + minDelay);
      }
      let checked = 0;
      for (let k = 0; k < n; k++) {
        const fa = runA.frames[k] as Frame;
        const fb = runB.frames[k] as Frame;
        if (fa.t >= tDiff + minDelay) break;
        for (const id of defenderIds) expect(fa.players[id]).toEqual(fb.players[id]);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(10);
      // Sanity: the change does matter later.
      const last = Math.min(n - 1, diffIdx + 45);
      const moved = defenderIds.some(
        (id) =>
          JSON.stringify((runA.frames[last] as Frame).players[id]) !==
          JSON.stringify((runB.frames[last] as Frame).players[id]),
      );
      expect(moved).toBe(true);
    },
  );
});

describe('T-ENG-05 leverage', () => {
  function run(leverage: 'inside' | 'outside') {
    const off = makePlay('offense', [qbSlot(), wrSlot('w', 'X', -10, 'slant', 4)]);
    const def = makePlay('defense', [
      slot(
        'cb',
        'CB',
        'CB1',
        { x: -10, y: 5 },
        [{ type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' }],
        leverage,
      ),
    ]);
    const r = simulate(makeInput(off, def));
    const brk = r.events.find((e) => e.type === 'break' && e.playerId === 'w');
    expect(brk).toBeDefined();
    // The defender sees the break after its reaction time (shortened toward its leverage side).
    return sepAt(r, 'w', (brk as { t: number }).t + 0.3);
  }

  it('slant vs inside leverage has less separation at the break than vs outside leverage', () => {
    const inside = run('inside');
    const outside = run('outside');
    expect(inside).toBeLessThan(outside);
  });
});

describe('T-ENG-06 stats matter', () => {
  function meanSeparation(wr: 'good' | 'weak'): number {
    const off = makePlay('offense', [qbSlot(), wrSlot('w', 'X', -10, 'go', 15)]);
    const def = makePlay('defense', [
      slot(
        'cb',
        'CB',
        'CB1',
        { x: -10, y: 5 },
        [{ type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' }],
        'inside',
      ),
    ]);
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const input = makeInput(off, def, { seed, noise: true });
      input.offenseStats['w'] = { ...DEFAULT_PRESETS[wr] };
      // Keep the QB from throwing so the window is not truncated by an early (open) throw.
      input.offenseStats['q'] = { ...DEFAULT_PRESETS.avg, armRange: 0 };
      const r = simulate(input);
      const end = Math.min(throwTime(r) ?? 3, 3);
      for (const s of r.metrics.separation['w'] ?? []) {
        if (s.t <= end) {
          sum += s.d;
          n += 1;
        }
      }
    }
    return sum / n;
  }

  it('a good WR gets more separation than a weak WR against the same CB', () => {
    expect(meanSeparation('good')).toBeGreaterThan(meanSeparation('weak'));
  });
});

describe('T-ENG-08 pressure', () => {
  it('a good rusher with nobody open ends in a sack or a throwaway', () => {
    const off = makePlay('offense', [qbSlot(), wrSlot('a', 'A', -8, null), wrSlot('b', 'B', 8, null)]);
    const def = makePlay('defense', [
      slot(
        'c1',
        'CB',
        'CB1',
        { x: 8, y: 1 },
        [{ type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' }],
        'head-up',
      ),
      slot(
        'c2',
        'CB',
        'CB2',
        { x: -8, y: 1 },
        [{ type: 'man', target: { kind: 'number', side: 'weak', number: 1 }, technique: 'trail' }],
        'head-up',
      ),
      rusherSlot(),
    ]);
    for (let seed = 1; seed <= 6; seed++) {
      const input = makeInput(off, def, { seed, noise: true });
      input.defenseStats['r1'] = { ...DEFAULT_PRESETS.good };
      const r = simulate(input);
      expect(['sack', 'throwaway']).toContain(r.outcome.kind);
      expect(r.events.some((e) => e.type === 'pressure')).toBe(true);
    }
  });
});

describe('T-ENG-10 missing man target', () => {
  it('falls back to a hook zone with a warning and does not crash', () => {
    const off = makePlay('offense', [
      qbSlot(),
      wrSlot('a', 'A', -8, 'go', 15),
      wrSlot('b', 'B', 8, 'go', 15),
    ]);
    const def = makePlay('defense', [
      slot('cb', 'CB', 'CB1', { x: -6, y: 6 }, [
        { type: 'man', target: { kind: 'number', side: 'weak', number: 2 }, technique: 'trail' },
      ]),
    ]);
    const input = makeInput(off, def);
    const r = simulate(input);
    expect(r.warnings.some((w) => w.includes('CB1'))).toBe(true);
    const drop = zonePreset('hook-L', input.field).dropPoint;
    const first = (r.frames[0] as Frame).players['cb']?.pos as Point;
    const at = (r.frames[20] as Frame).players['cb'];
    expect(distance(at?.pos as Point, drop)).toBeLessThan(distance(first, drop));
    expect(at?.state).toBe('zone');
  });
});

describe('FR-MU-11/12 debug output and eyeTarget', () => {
  const input = makeInput(floodPlay(), cover3Play(), { noise: true, seed: 5 });
  const plain = simulate(input);
  const dbg = simulate(input, { debug: true });

  it('without debug there is no debug field; with debug the frames are identical', () => {
    expect(plain.debug).toBeUndefined();
    expect(dbg.frames).toEqual(plain.frames);
    expect(dbg.outcome).toEqual(plain.outcome);
  });

  it('has one entry per frame and per defender', () => {
    expect(dbg.debug?.defenders).toHaveLength(dbg.frames.length);
    for (const d of dbg.debug?.defenders ?? []) {
      expect(Object.keys(d).sort()).toEqual(['c-cb1', 'c-cb2', 'c-fs', 'c-lb', 'c-r1']);
    }
  });

  it('seen positions are the delayed ones, aim is reported for zone defenders', () => {
    const i = dbg.frames.findIndex((f) => f.t >= 1);
    const frame = dbg.frames[i] as Frame;
    const seen = dbg.debug?.defenders[i]?.['c-lb']?.seen ?? {};
    expect(Object.keys(seen)).toContain('f-z');
    // Z runs a go: the delayed position lags behind the true one by roughly reaction × speed.
    const truth = frame.players['f-z']?.pos as Point;
    const lag = distance(seen['f-z'] as Point, truth);
    expect(lag).toBeGreaterThan(0.2);
    expect(lag).toBeLessThan(3);
    expect(dbg.debug?.defenders[i]?.['c-lb']?.aim).toBeDefined();
  });

  it('frame.eyeTarget is set once the QB starts reading and is an offense receiver', () => {
    expect(plain.frames[0]?.eyeTarget).toBeUndefined();
    const withEye = plain.frames.filter((f) => f.eyeTarget !== undefined);
    expect(withEye.length).toBeGreaterThan(10);
    for (const f of withEye) expect(f.players[f.eyeTarget as string]).toBeDefined();
  });
});
