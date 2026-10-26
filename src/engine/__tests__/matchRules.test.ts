import { describe, expect, it } from 'vitest';
import type { MatchRule, ReceiverRef } from '@/domain/types';
import { centroid, evaluateRules, eventHolds } from '../matchRules';
import type { PerceivedPlayer } from '../types';

function pp(x: number, y: number, vx: number, vy: number, id = 'wr'): PerceivedPlayer {
  return { id, side: 'offense', role: 'WR', pos: { x, y }, vel: { x: vx, y: vy } };
}
const S = { strongSign: 1 as const };

describe('eventHolds', () => {
  it('release: y > 0.5', () => {
    expect(eventHolds('release', pp(5, 0.6, 0, 0), S)).toBe(true);
    expect(eventHolds('release', pp(5, 0.5, 0, 3), S)).toBe(false);
  });
  it('vertical: ratio >= 0.7 boundary, forward only', () => {
    expect(eventHolds('vertical', pp(5, 10, 0, 5), S)).toBe(true);
    expect(eventHolds('vertical', pp(5, 10, 0, -5), S)).toBe(false);
    expect(eventHolds('vertical', pp(5, 10, 4, 3), S)).toBe(false);
    expect(eventHolds('vertical', pp(5, 10, 0, 0), S)).toBe(false);
    // just either side of the 0.7 ratio
    expect(eventHolds('vertical', pp(5, 10, Math.sqrt(1 - 0.71 ** 2), 0.71), S)).toBe(true);
    expect(eventHolds('vertical', pp(5, 10, Math.sqrt(1 - 0.69 ** 2), 0.69), S)).toBe(false);
  });
  it('vertical honours minDepth', () => {
    expect(eventHolds('vertical', pp(5, 7.9, 0, 5), { ...S, minDepth: 8 })).toBe(false);
    expect(eventHolds('vertical', pp(5, 8, 0, 5), { ...S, minDepth: 8 })).toBe(true);
  });
  it('out: toward own sideline, right and left', () => {
    expect(eventHolds('out', pp(6, 5, 3, 1), S)).toBe(true);
    expect(eventHolds('out', pp(-6, 5, -3, 1), S)).toBe(true);
    expect(eventHolds('out', pp(6, 5, -3, 1), S)).toBe(false);
    expect(eventHolds('out', pp(-6, 5, 3, 1), S)).toBe(false);
    expect(eventHolds('out', pp(6, 5, 0.6, 0.8), S)).toBe(true); // exactly 0.6
    expect(eventHolds('out', pp(6, 5, 0.59, 0.81), S)).toBe(false);
  });
  it('on-ball receiver uses strongSign as outside', () => {
    expect(eventHolds('out', pp(0, 5, 3, 0.5), { strongSign: 1 })).toBe(true);
    expect(eventHolds('out', pp(0, 5, 3, 0.5), { strongSign: -1 })).toBe(false);
    expect(eventHolds('in', pp(0.1, 8, 3, 0.5), { strongSign: -1 })).toBe(true);
  });
  it('in: toward ball and deeper than 6; under: toward ball and <= 6', () => {
    expect(eventHolds('in', pp(6, 8, -3, 1), S)).toBe(true);
    expect(eventHolds('in', pp(-6, 8, 3, 1), S)).toBe(true);
    expect(eventHolds('in', pp(6, 6, -3, 1), S)).toBe(false);
    expect(eventHolds('under', pp(6, 6, -3, 1), S)).toBe(true);
    expect(eventHolds('under', pp(6, 6.1, -3, 1), S)).toBe(false);
    expect(eventHolds('under', pp(6, 4, 3, 1), S)).toBe(false);
  });
  it('stop: slow only after release', () => {
    expect(eventHolds('stop', pp(5, 5, 0.5, 0.5), S)).toBe(true);
    expect(eventHolds('stop', pp(5, 5, 1, 0), S)).toBe(false);
    expect(eventHolds('stop', pp(5, 0, 0, 0), S)).toBe(false);
  });
  it('zero speed: only release and stop can hold', () => {
    const p = pp(5, 5, 0, 0);
    expect(eventHolds('vertical', p, S)).toBe(false);
    expect(eventHolds('out', p, S)).toBe(false);
    expect(eventHolds('in', p, S)).toBe(false);
    expect(eventHolds('under', p, S)).toBe(false);
    expect(eventHolds('release', p, S)).toBe(true);
    expect(eventHolds('stop', p, S)).toBe(true);
  });
});

const ref1: ReceiverRef = { kind: 'number', side: 'strong', number: 1 };
const ref2: ReceiverRef = { kind: 'number', side: 'strong', number: 2 };
const idOf = (r: ReceiverRef): string | null =>
  r.kind === 'number' ? (r.number === 1 ? 'wr1' : r.number === 2 ? 'wr2' : null) : null;

function rule(id: string, priority: number, over: Partial<MatchRule> = {}): MatchRule {
  return {
    id,
    priority,
    when: { receiver: ref1, event: 'vertical' },
    then: { type: 'carry' },
    ...over,
  };
}

function ev(over: Partial<Parameters<typeof evaluateRules>[0]> = {}) {
  return evaluateRules({
    rules: [rule('a', 1)],
    perceived: [pp(5, 10, 0, 5, 'wr1'), pp(-5, 10, 0, 5, 'wr2')],
    resolveRef: idOf,
    t: 1,
    iq: 1,
    fired: new Set<string>(),
    heldSince: {},
    strongSign: 1,
    resolveThenRef: idOf,
    ...over,
  });
}

describe('evaluateRules', () => {
  it('fires carry with the receiver id (T-ENG-09 module level)', () => {
    const r = ev();
    expect(r.fired?.rule.id).toBe('a');
    expect(r.fired?.outcome).toEqual({ type: 'carry', receiverId: 'wr1' });
  });
  it('passOff and zone outcomes', () => {
    expect(ev({ rules: [rule('a', 1, { then: { type: 'passOff' } })] }).fired?.outcome).toEqual({
      type: 'passOff',
      receiverId: 'wr1',
    });
    expect(
      ev({ rules: [rule('a', 1, { then: { type: 'zone', zone: 'deep-middle' } })] }).fired?.outcome,
    ).toEqual({ type: 'zone', zone: 'deep-middle' });
  });
  it('man outcome resolves target; null target skips rule', () => {
    const man = rule('m', 1, { then: { type: 'man', target: ref2 } });
    expect(ev({ rules: [man] }).fired?.outcome).toEqual({ type: 'man', targetId: 'wr2' });
    const bad = rule('b', 1, {
      then: { type: 'man', target: { kind: 'number', side: 'weak', number: 3 } },
    });
    const next = rule('n', 2);
    expect(ev({ rules: [bad, next] }).fired?.rule.id).toBe('n');
  });
  it('priority order, first match wins, stable ties', () => {
    const hi = rule('hi', 5);
    const lo = rule('lo', 1);
    expect(ev({ rules: [hi, lo] }).fired?.rule.id).toBe('lo');
    expect(ev({ rules: [rule('x', 1), rule('y', 1)] }).fired?.rule.id).toBe('x');
    const nomatch = rule('nm', 0, { when: { receiver: ref1, event: 'out' } });
    expect(ev({ rules: [nomatch, hi] }).fired?.rule.id).toBe('hi');
  });
  it('beforeTime requires t < beforeTime', () => {
    const r = rule('a', 1, { when: { receiver: ref1, event: 'vertical', beforeTime: 2 } });
    expect(ev({ rules: [r], t: 1.9 }).fired).not.toBeNull();
    expect(ev({ rules: [r], t: 2 }).fired).toBeNull();
  });
  it('minDepth applies', () => {
    const r = rule('a', 1, { when: { receiver: ref1, event: 'vertical', minDepth: 12 } });
    expect(ev({ rules: [r] }).fired).toBeNull();
  });
  it('unresolvable or unperceived receiver does not fire', () => {
    expect(ev({ resolveRef: () => null }).fired).toBeNull();
    expect(ev({ perceived: [] }).fired).toBeNull();
  });
  it('fired rules are skipped', () => {
    const r = ev({ rules: [rule('a', 1), rule('b', 2)], fired: new Set(['a']) });
    expect(r.fired?.rule.id).toBe('b');
  });
  it('iq delay: iq 0 needs 0.3 s continuous hold; interruption resets', () => {
    const first = ev({ iq: 0, t: 1 });
    expect(first.fired).toBeNull();
    expect(first.heldSince).toEqual({ a: 1 });
    const mid = ev({ iq: 0, t: 1.2, heldSince: first.heldSince });
    expect(mid.fired).toBeNull();
    const done = ev({ iq: 0, t: 1.3, heldSince: first.heldSince });
    expect(done.fired?.rule.id).toBe('a');
    // interruption: event does not hold at 1.2 -> reset
    const broken = ev({
      iq: 0,
      t: 1.2,
      heldSince: first.heldSince,
      perceived: [pp(5, 10, 5, 0, 'wr1')],
    });
    expect(broken.heldSince).toEqual({});
    const again = ev({ iq: 0, t: 1.3, heldSince: broken.heldSince });
    expect(again.fired).toBeNull();
    // partial iq
    expect(ev({ iq: 0.5, t: 1.1, heldSince: { a: 1 } }).fired).toBeNull();
  });
  it('does not mutate input heldSince', () => {
    const held = Object.freeze({ z: 0.5 });
    const r = ev({ iq: 0, heldSince: held });
    expect(held).toEqual({ z: 0.5 });
    expect(r.heldSince).not.toBe(held);
  });
});

describe('centroid', () => {
  it('is the arithmetic mean', () => {
    expect(
      centroid([
        { x: 0, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 4 },
      ]),
    ).toEqual({ x: 2, y: 2 });
  });
});
