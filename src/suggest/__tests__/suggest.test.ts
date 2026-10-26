import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { AggregateResult, Play } from '@/domain/types';
import { makePlay, slot } from '@/engine/__tests__/fixtures';
import { createSuggestCache, stableHash, suggestKey } from '../cache';
import { defenseSimScore, offenseSimScore, rankByTag, rankWithSim, totalScore, YARDS_NORM } from '../scoring';
import { beatsTags, coverageTags, tagMatch } from '../tags';

function play(side: 'offense' | 'defense', id: string, name: string, tags: string[], fmt = '5v5'): Play {
  return { ...makePlay(side, []), id, name, tags, format: fmt as Play['format'] };
}

function agg(p: Partial<AggregateResult> = {}): AggregateResult {
  return {
    runs: 30,
    outcomes: {} as AggregateResult['outcomes'],
    pComplete: 0,
    pSack: 0,
    pInt: 0,
    avgYards: 0,
    avgYardsPerCompletion: 0,
    avgTimeToThrow: null,
    targetDistribution: {},
    perTarget: {},
    avgSeparationAtThrow: {},
    ...p,
  };
}

const smash = play('offense', 'smash', 'Smash', ['beats:cover-2', 'concept:flood']);
const mesh = play('offense', 'mesh', 'Mesh', ['beats:man']);
const c2 = play('defense', 'c2', 'Cover 2', ['cov:cover-2']);
const c3 = play('defense', 'c3', 'Cover 3', ['cov:cover-3']);
const c1 = play('defense', 'c1', 'Cover 1', ['cov:cover-1', 'cov:man']);

describe('suggest tags', () => {
  it('extracts coverage and beats tags, blitz included', () => {
    expect(coverageTags(c1)).toEqual(['cover-1', 'man']);
    expect(coverageTags(play('defense', 'b', 'B', ['blitz']))).toEqual(['blitz']);
    expect(beatsTags(smash)).toEqual(['cover-2']);
  });
  it('Smash vs Cover 2 = 1, vs Cover 3 = 0, Mesh vs Cover 1 = 1', () => {
    expect(tagMatch(smash, c2)).toBe(1);
    expect(tagMatch(smash, c3)).toBe(0);
    expect(tagMatch(mesh, c1)).toBe(1);
    expect(tagMatch(play('offense', 'o', 'O', ['beats:blitz']), play('defense', 'b', 'B', ['blitz']))).toBe(
      1,
    );
  });
});

describe('suggest scoring', () => {
  it('offenseSimScore follows the formula', () => {
    const a = agg({ pComplete: 0.8, avgYards: 7.5, pSack: 0.1, pInt: 0.05 });
    expect(offenseSimScore(a)).toBeCloseTo(0.5 * 0.8 + 0.3 * 0.5 - 0.01 - 0.005, 10);
    expect(YARDS_NORM).toBe(15);
  });
  it('clamps to [0,1] and defense = 1 - offense', () => {
    expect(offenseSimScore(agg({ pSack: 1, pInt: 1 }))).toBe(0);
    expect(offenseSimScore(agg({ pComplete: 1, avgYards: 100 }))).toBeCloseTo(0.8, 10);
    const a = agg({ pComplete: 0.6, avgYards: 3 });
    expect(defenseSimScore(a)).toBeCloseTo(1 - offenseSimScore(a), 10);
  });
  it('totalScore applies weights; null sim contributes 0', () => {
    const t = DEFAULT_TUNING;
    expect(totalScore(1, 0.5, 0.2, t)).toBeCloseTo(0.2 + 0.35 + 0.02, 10);
    expect(totalScore(1, null, 0, t)).toBeCloseTo(0.2, 10);
  });
  it('rankByTag filters side/format, orders by tag then name, limits', () => {
    const other = play('defense', 'x', 'Alpha', ['cov:cover-3']);
    const wrongFmt = play('defense', 'y', 'Zed', ['cov:cover-2'], '7v7');
    const sameSide = play('offense', 'z', 'Q', ['beats:cover-2']);
    const res = rankByTag(smash, [c3, other, c2, wrongFmt, sameSide], DEFAULT_TUNING);
    expect(res.map((s) => s.play.id)).toEqual(['c2', 'x', 'c3']);
    expect(res[0]?.reasons).toEqual([{ kind: 'tag', tag: 'beats:cover-2' }]);
    expect(res[1]?.reasons).toEqual([]);
    expect(rankByTag(smash, [c3, other, c2], DEFAULT_TUNING, 1)).toHaveLength(1);
  });
  it('rankWithSim for offense: combines, orders, limits, explains with numbers', () => {
    const slant = play('offense', 'slant', 'Slant', ['beats:cover-3']);
    slant.players = [
      slot('a', 'WR', 'X', { x: 0, y: 0 }, [
        { type: 'route', path: [{ x: 1, y: 5 }], templateId: 'slant', endBehavior: 'stop' },
      ]),
      slot('b', 'WR', 'Z', { x: 5, y: 0 }, []),
    ];
    const aggSlant = agg({
      pComplete: 0.74,
      avgYards: 6,
      perTarget: {
        a: { throws: 10, completes: 8, avgSepAtThrow: 2.3 },
        b: { throws: 10, completes: 8, avgSepAtThrow: 1 },
      },
    });
    const aggMesh = agg({ pComplete: 0.3, avgYards: 2 });
    const res = rankWithSim({
      direction: 'offense-vs-coverage',
      given: c3,
      candidates: [mesh, slant],
      aggregates: { slant: aggSlant, mesh: aggMesh },
      tuning: DEFAULT_TUNING,
    });
    expect(res[0]?.play.id).toBe('slant');
    const kinds = res[0]?.reasons.map((r) => r.kind);
    expect(kinds).toEqual(['tag', 'sim', 'target']);
    expect(res[0]?.reasons[2]).toEqual({
      kind: 'target',
      label: 'X',
      routeName: 'slant',
      avgSepAtThrow: 2.3,
      completion: 0.8,
    });
    expect(res[0]?.reasons[1]).toMatchObject({ pComplete: 0.74, avgYards: 6 });
    expect(res[0]?.score).toBeCloseTo(0.2 + 0.7 * offenseSimScore(aggSlant), 10);
    expect(
      rankWithSim({
        direction: 'offense-vs-coverage',
        given: c3,
        candidates: [mesh, slant],
        aggregates: {},
        tuning: DEFAULT_TUNING,
        limit: 1,
      }),
    ).toHaveLength(1);
  });
  it('rankWithSim for defense inverts the sim score and orders; default limit 5', () => {
    const defs = Array.from({ length: 7 }, (_, i) => play('defense', `d${i}`, `D${i}`, []));
    const aggs = Object.fromEntries(defs.map((d, i) => [d.id, agg({ pComplete: i / 10 })]));
    const res = rankWithSim({
      direction: 'defense-vs-play',
      given: smash,
      candidates: defs,
      aggregates: aggs,
      tuning: DEFAULT_TUNING,
    });
    expect(res).toHaveLength(5);
    expect(res[0]?.play.id).toBe('d0');
    expect(res[0]?.sim).toBeCloseTo(1, 10);
  });
});

describe('suggest cache', () => {
  const t = DEFAULT_TUNING;
  it('hashes are stable regardless of key order', () => {
    expect(stableHash({ a: 1, b: [1, 2] })).toBe(stableHash({ b: [1, 2], a: 1 }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
  });
  it('same inputs → same key; route edit or tuning change → different key', () => {
    const k = suggestKey(smash, c2, ['l1', undefined], t);
    expect(suggestKey({ ...smash }, c2, ['l1', undefined], t)).toBe(k);
    const edited = {
      ...smash,
      players: [
        slot('a', 'WR', 'X', { x: 0, y: 0 }, [
          { type: 'route', path: [{ x: 1, y: 5 }], endBehavior: 'stop' },
        ]),
      ],
    };
    expect(suggestKey(edited, c2, ['l1', undefined], t)).not.toBe(k);
    expect(suggestKey(smash, c2, ['l1', undefined], { ...t, catchRadius: 2 })).not.toBe(k);
    expect(suggestKey(smash, c2, ['l2', undefined], t)).not.toBe(k);
  });
  it('LRU evicts least recently used at max', () => {
    const c = createSuggestCache(2);
    c.set('a', agg());
    c.set('b', agg());
    c.get('a');
    c.set('c', agg());
    expect(c.size()).toBe(2);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBeDefined();
    c.clear();
    expect(c.size()).toBe(0);
  });
});
