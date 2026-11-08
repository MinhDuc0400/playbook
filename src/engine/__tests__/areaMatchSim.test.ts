import { describe, expect, it } from 'vitest';
import { flipPlay } from '@/domain/flip';
import type { SimEvent, SimInput } from '@/domain/types';
import { prepareSim } from '../prepare';
import { simulate } from '../simulate';
import { bangkokPlay, bunchTightPlay, floodPlay, makeInput, slot } from './fixtures';

const RED_ZONE = { x: 0, yardLine: 45 };
const input = (o: SimInput['offense'], d: SimInput['defense'] = bangkokPlay()) =>
  makeInput(o, d, { ballSpot: RED_ZONE });

function claims(events: SimEvent[]): Record<string, { receiverId: string; reason: string; t: number }> {
  const out: Record<string, { receiverId: string; reason: string; t: number }> = {};
  for (const e of events) {
    if (e.type !== 'areaClaim' || !e.playerId) continue;
    out[e.playerId] = { receiverId: String(e.data?.receiverId), reason: String(e.data?.reason), t: e.t };
  }
  return out;
}

const throwTime = (events: SimEvent[]) => events.find((e) => e.type === 'throwStart')?.t ?? Infinity;

describe('T-AM area match in the sim (D-40)', () => {
  it('T-AM-01 Z out first → CB1 on Z, Y out second → S on Y', () => {
    const r = simulate(
      input(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } })),
    );
    const c = claims(r.events);
    expect(c['b-cb1']).toMatchObject({ receiverId: 'bt-z', reason: 'first' });
    expect(c['b-s']).toMatchObject({ receiverId: 'bt-y', reason: 'second' });
    const ev = r.events.find((e) => e.type === 'areaClaim' && e.playerId === 'b-cb1');
    expect(ev?.targetId).toBe('bt-z');
  });

  it('T-AM-02 Z slant, Y seam, nobody out → CB1 squeezes onto Y, S never goes man', () => {
    const r = simulate(input(bunchTightPlay({ x: 'hitch', c: 'hitch', y: 'go', z: 'slant' })));
    const c = claims(r.events);
    expect(c['b-cb1']).toMatchObject({ receiverId: 'bt-y', reason: 'squeeze' });
    expect(c['b-cb1']!.t).toBeGreaterThanOrEqual(0.5);
    expect(c['b-cb1']!.t).toBeLessThanOrEqual(1.5);
    const s = c['b-s'];
    expect(s === undefined || s.t >= throwTime(r.events)).toBe(true);
  });

  it('T-AM-03 flipped offense: CB2 on Z first, LB on Y second', () => {
    const off = flipPlay(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } }));
    const c = claims(simulate(input(off)).events);
    expect(c['b-cb2']).toMatchObject({ receiverId: 'bt-z', reason: 'first' });
    expect(c['b-lb']).toMatchObject({ receiverId: 'bt-y', reason: 'second' });
  });

  it('T-AM-03b flipping both sides keeps the same pairs (CB1 on Z, S on Y)', () => {
    const off = flipPlay(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } }));
    const c = claims(simulate(input(off, flipPlay(bangkokPlay()))).events);
    expect(c['b-cb1']).toMatchObject({ receiverId: 'bt-z', reason: 'first' });
    expect(c['b-s']).toMatchObject({ receiverId: 'bt-y', reason: 'second' });
  });

  it('T-AM-04 Trips Flood: CB1 takes Z, S takes Y (both aligned in the CB lane)', () => {
    const c = claims(simulate(input(floodPlay())).events);
    expect(c['b-cb1']).toMatchObject({ receiverId: 'f-z', reason: 'first' });
    expect(c['b-s']).toMatchObject({ receiverId: 'f-y', reason: 'second' });
  });

  it('T-AM-05 deterministic: same input twice gives the same frames', () => {
    const i = input(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'corner' }));
    expect(simulate(i).frames).toEqual(simulate(i).frames);
  });

  it('T-AM-06 moving S moves the lanes', () => {
    const d = bangkokPlay();
    const before = prepareSim(input(floodPlay(), d)).bindings['b-s'];
    const moved = {
      ...d,
      players: d.players.map((p) => (p.id === 'b-s' ? { ...p, start: { x: 7, y: 3.5 } } : p)),
    };
    const after = prepareSim(input(floodPlay(), moved)).bindings['b-s'];
    expect(before?.kind).toBe('areaMatch');
    expect(after?.kind).toBe('areaMatch');
    if (before?.kind !== 'areaMatch' || after?.kind !== 'areaMatch') return;
    expect(before.lanes.boundaries).toEqual([-4.75, 1.25, 6.5]);
    expect(after.lanes.boundaries).toEqual([-4.75, 2.75, 8]);
  });

  it('a corner with no zone action gets its lane rectangle as base', () => {
    const b = prepareSim(input(floodPlay())).bindings['b-cb1'];
    if (b?.kind !== 'areaMatch') throw new Error('expected areaMatch');
    const xs = b.base.polygon.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(6.5);
    expect(b.base.dropPoint.y).toBe(5);
  });

  it("areaMatch on a rusher does not change the other defenders' claims", () => {
    const off = bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } });
    const d = bangkokPlay();
    d.players = d.players.map((p) => (p.id === 'b-r' ? { ...p, areaMatch: { role: 'corner' as const } } : p));
    const withR = claims(simulate(input(off, d)).events);
    const without = claims(simulate(input(off)).events);
    expect(withR).toEqual(without);
  });

  it('areaMatch on a rusher is ignored with a warning', () => {
    const d = bangkokPlay();
    d.players = d.players.map((p) => (p.id === 'b-r' ? { ...p, areaMatch: { role: 'corner' as const } } : p));
    const prep = prepareSim(input(floodPlay(), d));
    expect(prep.bindings['b-r']?.kind).toBe('rush');
    expect(prep.warnings.some((w) => w.includes('area match ignored'))).toBe(true);
  });

  it('match rules on an area-match slot are ignored with a warning', () => {
    const d = bangkokPlay();
    d.players = d.players.map((p) =>
      p.id === 'b-s'
        ? {
            ...p,
            matchRules: [
              {
                id: 'm1',
                priority: 0,
                when: { receiver: { kind: 'number', side: 'strong', number: 1 }, event: 'vertical' },
                then: { type: 'carry' },
              },
            ],
          }
        : p,
    );
    const prep = prepareSim(input(floodPlay(), d));
    expect(prep.bindings['b-s']?.kind).toBe('areaMatch');
    expect(prep.warnings.some((w) => w.includes('match rules ignored'))).toBe(true);
  });

  it('a single area defender plays its base zone', () => {
    const d = bangkokPlay();
    d.players = [
      { ...slot('solo', 'LB', 'LB', { x: 0, y: 4 }), areaMatch: { role: 'inside' } },
      d.players.find((p) => p.id === 'b-r')!,
    ];
    const r = simulate(input(floodPlay(), d));
    expect(r.frames.length).toBeGreaterThan(0);
    expect(r.frames[Math.min(30, r.frames.length - 1)]!.players['solo']?.state).toBe('zone');
  });

  it('area defenders hold their alignment depth until they pick up a man (no press)', () => {
    const d = bangkokPlay();
    const r = simulate(input(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'corner' }), d));
    const c = claims(r.events);
    const tThrow = throwTime(r.events);
    const report: Record<string, number> = {};
    for (const id of ['b-cb2', 'b-lb', 'b-s', 'b-cb1']) {
      const start = d.players.find((p) => p.id === id)!.start;
      const until = Math.min(c[id]?.t ?? Infinity, tThrow);
      let minY = Infinity;
      for (const f of r.frames) {
        if (f.t <= 0 || f.t >= until) continue;
        minY = Math.min(minY, f.players[id]!.pos.y);
      }
      report[id] = Number((start.y - minY).toFixed(2));
    }
    // yards each defender came up toward the LOS before its claim / the throw
    for (const v of Object.values(report)) expect(v).toBeLessThanOrEqual(0.1);
  });
});
