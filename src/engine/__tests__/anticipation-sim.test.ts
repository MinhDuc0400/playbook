import { describe, expect, it } from 'vitest';
import type { Frame, Point, RouteAction, SimResult } from '@/domain/types';
import { simulate } from '../simulate';
import { floodPlay, makeInput, makePlay, qbSlot, slot, wrSlot, zoneSlot } from './fixtures';

function manSlot(id: string, label: string, start: Point, target: Parameters<typeof manAction>[0]) {
  return slot(id, 'CB', label, start, [manAction(target)], 'head-up');
}
function manAction(
  target: { kind: 'number'; side: 'strong' | 'weak'; number: 1 | 2 | 3 } | { kind: 'role'; role: 'C' },
) {
  return { type: 'man' as const, target, technique: 'cushion' as const, cushion: 4 };
}

/** Cover 1 man: four man defenders on Z/Y/H/C plus a deep-middle safety. */
function cover1() {
  return makePlay('defense', [
    manSlot('d1', 'CB1', { x: 12, y: 4 }, { kind: 'number', side: 'strong', number: 1 }),
    manSlot('d2', 'LB2', { x: 8, y: 4 }, { kind: 'number', side: 'strong', number: 2 }),
    manSlot('d3', 'LB3', { x: 4.5, y: 4 }, { kind: 'number', side: 'strong', number: 3 }),
    manSlot('d4', 'LB4', { x: 0, y: 4 }, { kind: 'role', role: 'C' }),
    zoneSlot('d5', 'S', 'FS', { x: 0, y: 11 }, 'deep-third-M', { x: 0, y: 16 }, 'head-up'),
  ]);
}

function throwTime(r: SimResult): number | undefined {
  return r.events.find((e) => e.type === 'throw')?.t;
}

describe('T-ENG-07 anticipation reduces separation', () => {
  function meanSeparation(a: number): number {
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const r = simulate(makeInput(floodPlay(), cover1(), { seed, noise: true, anticipation: a }));
      const end = Math.min(throwTime(r) ?? 3, 3);
      for (const series of Object.values(r.metrics.separation)) {
        for (const s of series) {
          if (s.t <= end) {
            sum += s.d;
            n += 1;
          }
        }
      }
    }
    return sum / n;
  }

  it('mean separation strictly decreases for a = 0, 0.5, 1', () => {
    const s0 = meanSeparation(0);
    const s5 = meanSeparation(0.5);
    const s1 = meanSeparation(1);
    expect(s5).toBeLessThan(s0);
    expect(s1).toBeLessThan(s5);
  });
});

describe('T-ENG-03 oracle reads the future', () => {
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
  ]);

  function firstDefenderDiff(a: number): number {
    const runA = simulate(makeInput(offenseWith([{ x: -10, y: 15 }]), defense, { anticipation: a }));
    const runB = simulate(makeInput(offenseWith([{ x: -2, y: 10 }]), defense, { anticipation: a }));
    const n = Math.min(runA.frames.length, runB.frames.length);
    let tOff = Infinity;
    let tDef = Infinity;
    for (let k = 0; k < n; k++) {
      const fa = runA.frames[k] as Frame;
      const fb = runB.frames[k] as Frame;
      if (tOff === Infinity && JSON.stringify(fa.players['a']) !== JSON.stringify(fb.players['a']))
        tOff = fa.t;
      if (tDef === Infinity && JSON.stringify(fa.players['cb']) !== JSON.stringify(fb.players['cb']))
        tDef = fa.t;
    }
    expect(tOff).toBeLessThan(Infinity);
    expect(tDef).toBeLessThan(Infinity);
    return tDef - tOff;
  }

  it('with a = 1 the defender reacts before the offensive change is even visible; with a = 0.5 it cannot', () => {
    // a = 0.5: the defender can only differ after the minimum perception delay (> 0).
    expect(firstDefenderDiff(0.5)).toBeGreaterThan(0.1);
    // a = 1: the oracle looks `lookahead` ahead, so the defender differs at or before the change.
    expect(firstDefenderDiff(1)).toBeLessThanOrEqual(0.1);
  });
});
