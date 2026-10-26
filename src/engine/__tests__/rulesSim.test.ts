import { describe, expect, it } from 'vitest';
import { DEFAULT_BALL_SPOT, createDefaultFields } from '@/domain/field';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import type { ID, MatchRule, Point, ReceiverRef } from '@/domain/types';
import { zonePreset } from '@/domain/zones';
import { createRuleDefender } from '../agents/ruleDefender';
import { simulate } from '../simulate';
import type { AgentState, FieldInfo, PerceivedPlayer, Perception } from '../types';
import { makeInput, makePlay, qbSlot, slot, wrSlot, zoneSlot } from './fixtures';

const strong = (n: 1 | 2 | 3): ReceiverRef => ({ kind: 'number', side: 'strong', number: n });
const noThrow = { ...DEFAULT_PRESETS.avg, armRange: 0 };

function rule(over: Partial<MatchRule> & Pick<MatchRule, 'then'>): MatchRule {
  return {
    id: 'r1',
    priority: 1,
    when: { receiver: strong(2), event: 'vertical', minDepth: 8 },
    ...over,
  };
}

/** Strong #1 (x 12) idles, strong #2 (x 8) runs `innerRoute`, weak #1 (x -10) idles; QB never throws. */
function setup(defense: ReturnType<typeof makePlay>, innerRoute: 'go' | 'out' | null) {
  const off = makePlay(
    'offense',
    [
      qbSlot(),
      wrSlot('o1', 'Z', 12, null),
      wrSlot('o2', 'Y', 8, innerRoute, innerRoute === 'go' ? 20 : 6),
      wrSlot('o3', 'X', -10, null),
    ],
    [],
  );
  const input = makeInput(off, defense, { seed: 3 });
  input.offenseStats['q'] = noThrow;
  input.tuning.maxTime = 5;
  return input;
}

const hookLb = (rules?: MatchRule[]) => {
  const s = zoneSlot('d1', 'LB', 'LB', { x: 4, y: 6 }, 'hook-R', { x: 4, y: 7 }, 'head-up');
  return rules ? { ...s, matchRules: rules } : s;
};

describe('T-ENG-09 match rule fires on vertical', () => {
  it('carry: hook defender follows the go route beyond its zone after the rule fires', () => {
    const withRule = simulate(
      setup(makePlay('defense', [hookLb([rule({ then: { type: 'carry' } })])]), 'go'),
    );
    const without = simulate(setup(makePlay('defense', [hookLb()]), 'go'));
    const fired = withRule.events.filter((e) => e.type === 'ruleFired');
    expect(fired).toHaveLength(1);
    expect(fired[0]?.playerId).toBe('d1');
    expect(fired[0]?.data).toEqual({ ruleId: 'r1', outcome: 'carry' });
    // The receiver must really have been past minDepth when the (delayed, iq-lagged) rule fired.
    const recAtFire = withRule.frames.find((f) => f.t >= (fired[0]?.t ?? 0))?.players['o2'];
    expect(recAtFire?.pos.y).toBeGreaterThanOrEqual(8);
    expect(without.events.some((e) => e.type === 'ruleFired')).toBe(false);
    const at = (r: typeof withRule, t: number) => r.frames.find((f) => f.t >= t)?.players['d1']?.pos as Point;
    expect(at(withRule, 4).y).toBeGreaterThan(at(without, 4).y + 3);
    expect(at(withRule, 4).y).toBeGreaterThan(14);
  });

  it('a route that never goes vertical fires nothing', () => {
    const r = simulate(setup(makePlay('defense', [hookLb([rule({ then: { type: 'carry' } })])]), 'out'));
    expect(r.events.some((e) => e.type === 'ruleFired')).toBe(false);
  });

  it('man switch: tracks the new target (debug targetId changes) after the event', () => {
    const man = {
      ...slot('d1', 'CB', 'CB', { x: -10, y: 4 }, [
        { type: 'man', target: { kind: 'number', side: 'weak', number: 1 }, technique: 'trail' },
      ]),
      matchRules: [rule({ then: { type: 'man', target: strong(1) } })],
    };
    const r = simulate(setup(makePlay('defense', [man]), 'go'), { debug: true });
    const ev = r.events.find((e) => e.type === 'ruleFired');
    expect(ev?.data).toEqual({ ruleId: 'r1', outcome: 'man' });
    const dbg = (r.debug?.defenders ?? []).map((d) => d['d1']?.targetId);
    const iFire = r.frames.findIndex((f) => f.t >= (ev?.t ?? 0));
    expect(dbg[Math.max(0, iFire - 3)]).toBe('o3');
    expect(dbg[iFire + 1]).toBe('o1');
    const p = r.frames[r.frames.length - 1]?.players['d1']?.pos as Point;
    expect(p.x).toBeGreaterThan(0); // moved from the weak side toward the strong side
  });

  it('zone switch: becomes a zone defender on the new preset', () => {
    const man = {
      ...slot('d1', 'CB', 'CB', { x: 8, y: 4 }, [{ type: 'man', target: strong(2), technique: 'trail' }]),
      matchRules: [rule({ then: { type: 'zone', zone: 'deep-third-R' } })],
    };
    const r = simulate(setup(makePlay('defense', [man]), 'go'));
    expect(r.events.find((e) => e.type === 'ruleFired')?.data).toEqual({ ruleId: 'r1', outcome: 'zone' });
    const tFire = r.events.find((e) => e.type === 'ruleFired')?.t ?? 0;
    const before = r.frames.find((f) => f.t >= tFire - 0.1)?.players['d1'];
    const last = r.frames[r.frames.length - 1]?.players['d1'];
    expect(before?.state).toBe('man');
    expect(last?.state).toBe('zone');
    // The deep-third defender chases the go route (the only threat in its zone), well past the hook depth.
    expect(last?.pos.y).toBeGreaterThan(20);
  });

  it('priority: the lower priority number wins and each rule fires once', () => {
    const rules = [
      rule({ id: 'late', priority: 2, then: { type: 'carry' } }),
      rule({ id: 'early', priority: 1, then: { type: 'passOff' } }),
    ];
    const r = simulate(setup(makePlay('defense', [hookLb(rules)]), 'go'));
    const fired = r.events.filter((e) => e.type === 'ruleFired');
    expect(fired[0]?.data).toMatchObject({ ruleId: 'early' });
    expect(fired.filter((e) => e.data?.['ruleId'] === 'early')).toHaveLength(1);
  });
});

describe('rule defender agent outcomes', () => {
  const field = createDefaultFields()['5v5'];
  const info: FieldInfo = {
    field,
    ballSpot: DEFAULT_BALL_SPOT,
    minX: -15,
    maxX: 15,
    minY: -10,
    maxY: 60,
    tuning: { ...DEFAULT_TUNING },
  };
  const hook = zonePreset('hook-R', field);
  const recv = (id: ID, x: number, y: number): PerceivedPlayer => ({
    id,
    side: 'offense',
    role: 'WR',
    pos: { x, y },
    vel: { x: 0, y: 3 },
  });
  const perc = (others: PerceivedPlayer[], t: number): Perception => ({
    t,
    others,
    ball: { state: 'held', pos: { x: 0, y: -5 } },
    qb: { pos: { x: 0, y: -5 }, throwStarted: false },
  });
  const resolveRef = (ref: ReceiverRef): ID | null =>
    ref.kind === 'number' ? { 1: 'a', 2: 'b', 3: null }[ref.number] : null;
  const selfAt = (pos: Point, t: number): AgentState => ({
    id: 'd',
    side: 'defense',
    role: 'LB',
    label: 'LB',
    pos,
    vel: { x: 0, y: 0 },
    stats: { ...DEFAULT_PRESETS.avg, iq: 1 },
    t,
    hasBall: false,
    isBallTarget: false,
  });
  const rules = (then: MatchRule['then'], event: MatchRule['when']['event'] = 'release'): MatchRule[] => [
    { id: 'r', priority: 1, when: { receiver: strong(2), event }, then },
  ];
  const make = (r: MatchRule[], initial: Parameters<typeof createRuleDefender>[0]['initial']) =>
    createRuleDefender({ id: 'd', initial, rules: r, leverage: 'head-up', info, resolveRef, strongSign: 1 });
  const zoneInit = { kind: 'zone' as const, polygon: hook.polygon, dropPoint: hook.dropPoint, deep: false };
  const run = (agent: ReturnType<typeof make>, others: PerceivedPlayer[], pos: Point) => {
    let last = agent.step(selfAt(pos, 0), perc(others, 0), 1 / 60, () => 0.5);
    for (let i = 1; i < 5; i++)
      last = agent.step(selfAt(pos, i / 60), perc(others, i / 60), 1 / 60, () => 0.5);
    return last;
  };

  it('passOff in zone: the released receiver is no longer the aim', () => {
    const others = [recv('b', 6, 8)];
    const base = make([], zoneInit);
    run(base, others, { x: 4, y: 7 });
    const passed = make(rules({ type: 'passOff' }), zoneInit);
    const intent = run(passed, others, { x: 4, y: 7 });
    expect(intent.events).toBeUndefined();
    expect(base.lastAim?.y).toBeGreaterThan(7.5);
    expect(passed.lastAim).toEqual(hook.dropPoint);
  });

  it('emits ruleFired once with the outcome', () => {
    const agent = make(rules({ type: 'passOff' }), zoneInit);
    const evs: unknown[] = [];
    for (let i = 0; i < 10; i++) {
      const it = agent.step(
        selfAt({ x: 4, y: 7 }, i / 60),
        perc([recv('b', 6, 8)], i / 60),
        1 / 60,
        () => 0.5,
      );
      evs.push(...(it.events ?? []));
    }
    expect(evs).toEqual([{ type: 'ruleFired', data: { ruleId: 'r', outcome: 'passOff' } }]);
  });

  it('passOff on a man defender falls back to the hook zone on its side', () => {
    const agent = make(rules({ type: 'passOff' }), {
      kind: 'man',
      targetId: 'b',
      technique: 'trail',
      cushion: 0,
    });
    expect(agent.targetId).toBe('b');
    run(agent, [recv('b', 6, 8)], { x: 5, y: 7 });
    expect(agent.targetId).toBeNull();
    expect(agent.lastAim).toEqual(hook.dropPoint);
  });

  it('carry follows the receiver out of the zone; without it the receiver is released', () => {
    const out = [recv('b', 6, 20)];
    const carry = make(rules({ type: 'carry' }), zoneInit);
    run(carry, [recv('b', 6, 8)], { x: 4, y: 7 });
    run(carry, out, { x: 4, y: 7 });
    expect(carry.lastAim?.y).toBeGreaterThan(15);
    const plain = make([], zoneInit);
    run(plain, out, { x: 4, y: 7 });
    expect(plain.lastAim?.y).toBeLessThan(11);
  });
});
