import { describe, expect, it } from 'vitest';
import { cornerRules, insideRules, laneRectangle, withSnapBackpedal } from '@/domain/areaRules';
import { createDefaultFields } from '@/domain/field';
import { flipPlay } from '@/domain/flip';
import type { Action, PlayerSlot, SimEvent, SimInput } from '@/domain/types';
import { prepareSim } from '../prepare';
import { simulate } from '../simulate';
import { bangkokRulesPlay, bunchTightPlay, floodPlay, makeInput, makePlay, slot } from './fixtures';

const RED_ZONE = { x: 0, yardLine: 45 };
const field = createDefaultFields()['5v5'];
const input = (o: SimInput['offense'], d: SimInput['defense'] = bangkokRulesPlay()) =>
  makeInput(o, d, { ballSpot: RED_ZONE });

/** Area claims from `ruleFired` events with a target (D-48); reason from the rule's nth. */
function claims(events: SimEvent[]): Record<string, { receiverId: string; reason: string; t: number }> {
  const out: Record<string, { receiverId: string; reason: string; t: number }> = {};
  for (const e of events) {
    if (e.type !== 'ruleFired' || !e.playerId || !e.targetId) continue;
    const reason = e.data?.n === 1 ? 'first' : e.data?.n === 2 ? 'second' : String(e.data?.outcome);
    out[e.playerId] = { receiverId: e.targetId, reason, t: e.t };
  }
  return out;
}

const throwTime = (events: SimEvent[]) => events.find((e) => e.type === 'throwStart')?.t ?? Infinity;

describe('D-48 Bunch Killer on rules in the sim (ports T-AM)', () => {
  it('T-AM-01 Z out first → CB1 on Z, Y out second → S on Y', () => {
    const r = simulate(
      input(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } })),
    );
    const c = claims(r.events);
    expect(c['b-cb1']).toMatchObject({ receiverId: 'bt-z', reason: 'first' });
    expect(c['b-s']).toMatchObject({ receiverId: 'bt-y', reason: 'second' });
  });

  it('T-AM-02 Z slant, Y seam, nobody out → CB1 never claims and holds his spot; S never goes man', () => {
    const r = simulate(input(bunchTightPlay({ x: 'hitch', c: 'hitch', y: 'go', z: 'slant' })));
    const c = claims(r.events);
    expect(c['b-cb1']).toBeUndefined();
    const s = c['b-s'];
    expect(s === undefined || s.t >= throwTime(r.events)).toBe(true);
    const until = Math.min(throwTime(r.events), 3);
    for (const f of r.frames.filter((fr) => fr.t <= until)) {
      const p = f.players['b-cb1']!.pos;
      expect(Math.hypot(p.x - 9, p.y - 3.5)).toBeLessThan(1);
    }
  });

  it('T-AM-03 flipped offense: CB2 on Z first, LB on Y second', () => {
    const off = flipPlay(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } }));
    const c = claims(simulate(input(off)).events);
    expect(c['b-cb2']).toMatchObject({ receiverId: 'bt-z', reason: 'first' });
    expect(c['b-lb']).toMatchObject({ receiverId: 'bt-y', reason: 'second' });
  });

  it('T-AM-03b flipping both sides keeps the same pairs (CB1 on Z, S on Y)', () => {
    const off = flipPlay(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } }));
    const c = claims(simulate(input(off, flipPlay(bangkokRulesPlay()))).events);
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
    const d = bangkokRulesPlay();
    const before = prepareSim(input(floodPlay(), d)).bindings['b-s'];
    const moved = {
      ...d,
      players: d.players.map((p) => (p.id === 'b-s' ? { ...p, start: { x: 7, y: 3.5 } } : p)),
    };
    const after = prepareSim(input(floodPlay(), moved)).bindings['b-s'];
    if (before?.kind !== 'lane' || after?.kind !== 'lane') throw new Error('expected lane bindings');
    expect(before.lanes.boundaries).toEqual([-4.75, 1.25, 6.5]);
    expect(after.lanes.boundaries).toEqual([-4.75, 2.75, 8]);
  });

  it('D-51 a lane zone is the live lane: moving S moves its base zone with the lane lines', () => {
    const d = bangkokRulesPlay();
    const lane: Action = { type: 'zone', zone: 'lane', dropPoint: { x: 0, y: 0 } };
    const moved = {
      ...d,
      players: d.players.map((p) =>
        p.id === 'b-s' ? { ...p, start: { x: 7, y: 3.5 }, actions: [lane] } : p,
      ),
    };
    const b = prepareSim(input(floodPlay(), moved)).bindings['b-s'];
    if (b?.kind !== 'lane') throw new Error('expected a lane binding');
    const xs = b.base!.polygon.map((p) => p.x);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([2.75, 8]);
    expect(b.base!.deep).toBe(false);
  });

  it('D-51 a lane member with a zone gets its outline as his area; zone-less or lane-zone members get none', () => {
    const d = bangkokRulesPlay();
    const lane: Action = { type: 'zone', zone: 'lane', dropPoint: { x: 0, y: 0 } };
    const withLane = {
      ...d,
      players: d.players.map((p) => (p.id === 'b-lb' ? { ...p, actions: [lane] } : p)),
    };
    const b = prepareSim(input(floodPlay(), withLane)).bindings['b-s'];
    if (b?.kind !== 'lane') throw new Error('expected a lane binding');
    const area = (id: string) => b.members.find((m) => m.id === id)?.area;
    expect(area('b-s')).toEqual(b.base!.polygon);
    expect(area('b-cb1')).toBeUndefined();
    expect(area('b-lb')).toBeUndefined();
  });

  it('a corner with no zone stands (base null); an inside with a zone keeps it as base', () => {
    const b = prepareSim(input(floodPlay())).bindings;
    if (b['b-cb1']?.kind !== 'lane' || b['b-s']?.kind !== 'lane') throw new Error('expected lane bindings');
    expect(b['b-cb1'].base).toBeNull();
    expect(b['b-s'].base?.polygon.length).toBe(3);
  });

  it('area rules on a rusher are ignored with a warning and do not change the claims', () => {
    const off = bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } });
    const d = bangkokRulesPlay();
    d.players = d.players.map((p) => (p.id === 'b-r' ? { ...p, matchRules: cornerRules(() => 'r-bk') } : p));
    const prep = prepareSim(input(floodPlay(), d));
    expect(prep.bindings['b-r']?.kind).toBe('rush');
    expect(prep.warnings.some((w) => w.includes('R: area rule ignored'))).toBe(true);
    expect(claims(simulate(input(off, d)).events)).toEqual(claims(simulate(input(off)).events));
  });

  it('Review Focus 1: an inside rule naming a missing teammate is ignored with a warning', () => {
    const d = bangkokRulesPlay();
    d.players = d.players.map((p) =>
      p.id === 'b-s' ? { ...p, matchRules: insideRules(() => 's-bk', 'gone') } : p,
    );
    const prep = prepareSim(input(floodPlay(), d));
    expect(prep.warnings.some((w) => w.includes('S: area rule ignored'))).toBe(true);
    const r = simulate(input(floodPlay(), d));
    expect(claims(r.events)['b-s']).toBeUndefined();
  });

  it('Review Focus 1: a teammate turned rusher → the inside rule is ignored, other claims unchanged', () => {
    const off = floodPlay();
    const d = bangkokRulesPlay();
    d.players = d.players.map((p) =>
      p.id === 'b-cb1'
        ? { ...p, role: 'R' as const, matchRules: [], actions: [{ type: 'rush', path: [{ x: 0, y: -5 }] }] }
        : p,
    );
    const prep = prepareSim(input(off, d));
    expect(prep.warnings.some((w) => w.includes('S: area rule ignored'))).toBe(true);
    const c = claims(simulate(input(off, d)).events);
    expect(c['b-s']).toBeUndefined();
  });

  it('Review Focus 2: a duplicated corner becomes a lane member and the sim is deterministic', () => {
    const d = bangkokRulesPlay();
    const cb1 = d.players.find((p) => p.id === 'b-cb1')!;
    d.players = [
      ...d.players,
      { ...cb1, id: 'b-cb1b', label: 'CB3', start: { x: 11, y: 3.5 }, matchRules: cornerRules(() => 'x-bk') },
    ];
    const b = prepareSim(input(floodPlay(), d)).bindings['b-cb1b'];
    if (b?.kind !== 'lane') throw new Error('expected lane binding');
    expect(b.lanes.order).toHaveLength(5);
    const i = input(floodPlay(), d);
    expect(simulate(i).events).toEqual(simulate(i).events);
  });

  it('a single area defender plays its base zone', () => {
    const d = bangkokRulesPlay();
    d.players = [
      { ...slot('solo', 'LB', 'LB', { x: 0, y: 4 }), matchRules: insideRules(() => 'solo-bk', null) },
      d.players.find((p) => p.id === 'b-r')!,
    ];
    const r = simulate(input(floodPlay(), d));
    expect(r.frames.length).toBeGreaterThan(0);
    expect(r.frames[Math.min(30, r.frames.length - 1)]!.players['solo']?.state).toBe('zone');
  });

  it('area defenders hold their alignment depth until they pick up a man (no press)', () => {
    const d = bangkokRulesPlay();
    const r = simulate(input(bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'corner' }), d));
    const c = claims(r.events);
    const tThrow = throwTime(r.events);
    for (const id of ['b-cb2', 'b-lb', 'b-s', 'b-cb1']) {
      const start = d.players.find((p) => p.id === id)!.start;
      const until = Math.min(c[id]?.t ?? Infinity, tThrow);
      let minY = Infinity;
      for (const f of r.frames) {
        if (f.t <= 0 || f.t >= until) continue;
        minY = Math.min(minY, f.players[id]!.pos.y);
      }
      expect(Number((start.y - minY).toFixed(2))).toBeLessThanOrEqual(0.1);
    }
  });

  it('T-AM-07 user board: C runs out into CB2 lane while X goes vertical → CB2 on C, SS not on C', () => {
    const route = (path: { x: number; y: number }[]): Action => ({
      type: 'route',
      path,
      endBehavior: 'stop',
    });
    const off = makePlay(
      'offense',
      [
        slot('q', 'QB', 'Q', { x: -1, y: -3 }, [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]),
        slot('b', 'RB', 'B', { x: -4.5, y: 0 }, [
          route([
            { x: -4.5, y: 6 },
            { x: 5.5, y: 6 },
          ]),
        ]),
        slot('z', 'WR', 'Z', { x: -2, y: 0 }, [route([{ x: -2, y: 6 }])]),
        slot('c', 'C', 'C', { x: 0, y: 0 }, [
          route([
            { x: 1.4, y: 2 },
            { x: 14.5, y: 5 },
          ]),
        ]),
        slot('x', 'WR', 'X', { x: 2, y: 0 }, [
          route([
            { x: 2, y: 10 },
            { x: -8, y: 10 },
          ]),
        ]),
      ],
      ['c', 'x', 'b', 'z'],
    );
    const id = (s: string) => () => `${s}-bk`;
    const players: PlayerSlot[] = [
      slot('r1', 'R', 'R1', { x: -10.6, y: 7 }, [{ type: 'rush', path: [{ x: -1, y: -5 }], delay: 0 }]),
      { ...slot('cb1', 'CB', 'CB1', { x: -7.6, y: 5 }), matchRules: cornerRules(id('cb1')) },
      { ...slot('fs', 'S', 'FS', { x: -2, y: 5 }), matchRules: insideRules(id('fs'), 'cb1') },
      { ...slot('ss', 'S', 'SS', { x: 2.5, y: 5 }), matchRules: insideRules(id('ss'), 'cb2') },
      { ...slot('cb2', 'CB', 'CB2', { x: 7, y: 5 }), matchRules: cornerRules(id('cb2')) },
    ];
    // The insides had no zone: today they zone their lane rectangle (what the D-48 conversion writes).
    const withZones = players.map((p) =>
      p.id === 'fs' || p.id === 'ss'
        ? {
            ...p,
            actions: [
              {
                type: 'zone' as const,
                zone: { polygon: laneRectangle(players, p.id, field) },
                dropPoint: { x: p.start.x, y: 5 },
              },
            ],
          }
        : p,
    );
    const c = claims(simulate(makeInput(off, makePlay('defense', withZones), { ballSpot: RED_ZONE })).events);
    expect(c['cb2']).toMatchObject({ receiverId: 'c', reason: 'first' });
    expect(c['ss']?.receiverId).not.toBe('c');
    expect(c['cb1']?.receiverId).not.toBe('b');
  });

  it('D-52 backpedal at the snap: CB1 drops 3 yd straight back, then holds that depth', () => {
    const d = bangkokRulesPlay();
    d.players = d.players.map((p) =>
      p.id === 'b-cb1'
        ? { ...p, matchRules: withSnapBackpedal(p.matchRules ?? [], true, () => 'cb1-bp') }
        : p,
    );
    const r = simulate(input(bunchTightPlay({ x: 'hitch', c: 'hitch', y: 'go', z: 'slant' }), d));
    expect(r.events.some((e) => e.type === 'ruleFired' && e.data?.outcome === 'backpedal')).toBe(true);
    // Until he reacts to the ball: straight back, never past 3 yd, then he holds the new depth.
    const end = r.frames.findIndex((f) => f.t > 0 && f.players['b-cb1']!.state === 'ball');
    const frames = r.frames.slice(0, end).filter((f) => f.t > 0);
    const states = frames.map((f) => f.players['b-cb1']!.state);
    expect(states).toContain('backpedal');
    for (const f of frames) {
      const p = f.players['b-cb1']!.pos;
      expect(Math.abs(p.x - 9)).toBeLessThan(0.05);
      expect(p.y).toBeLessThan(3.5 + 3 + 0.1);
    }
    const last = frames[frames.length - 1]!.players['b-cb1']!;
    expect(last.state).toBe('zone');
    expect(last.pos.y).toBeCloseTo(6.5, 1);
  });

  it('D-52 without the backpedal rule nothing changes (same frames as the plain template)', () => {
    const off = bunchTightPlay({ x: 'hitch', c: 'hitch', y: 'go', z: 'slant' });
    const plain = bangkokRulesPlay();
    const off2 = bangkokRulesPlay();
    off2.players = off2.players.map((p) =>
      p.id === 'b-cb1'
        ? {
            ...p,
            matchRules: withSnapBackpedal(
              withSnapBackpedal(p.matchRules ?? [], true, () => 'x'),
              false,
              () => 'y',
            ),
          }
        : p,
    );
    expect(simulate(input(off, off2)).frames).toEqual(simulate(input(off, plain)).frames);
  });

  it('D-52 a receiver coming into his area during the backpedal still gets picked up', () => {
    const d = bangkokRulesPlay();
    d.players = d.players.map((p) =>
      p.id === 'b-cb1' || p.id === 'b-s'
        ? { ...p, matchRules: withSnapBackpedal(p.matchRules ?? [], true, () => `${p.id}-bp`) }
        : p,
    );
    const off = bunchTightPlay({ x: 'slant', c: 'hitch', y: 'flat', z: 'out', depths: { z: 2 } });
    const c = claims(simulate(input(off, d)).events);
    expect(c['b-cb1']).toMatchObject({ receiverId: 'bt-z', reason: 'first' });
    expect(c['b-s']).toMatchObject({ receiverId: 'bt-y', reason: 'second' });
  });
});
