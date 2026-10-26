import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  ROUTE_PRIOR_KEYS,
  createDefaultRoutePriors,
  createDefaultSettings,
} from '../defaults';
import { DEFAULT_PRESETS } from '../presets';
import { SCHEMA_VERSION, STAT_KEYS } from '../types';

const TEMPLATE_IDS = [
  'hitch',
  'slant',
  'out',
  'in',
  'go',
  'post',
  'corner',
  'curl',
  'comeback',
  'flat',
  'drag',
  'wheel',
  'whip',
  'out-and-up',
  'sluggo',
];

describe('DEFAULT_TUNING (SRS §11.2)', () => {
  it('matches the table', () => {
    expect(DEFAULT_TUNING).toEqual({
      simDt: 1 / 60,
      maxTime: 9,
      lookahead: 0.3,
      tellWindow: 0.25,
      leverageOffset: 1,
      leverageReactionFactor: 0.3,
      zoneBuffer: 2,
      eyeDriftFactor: 0.3,
      throwOpenThreshold: 1.5,
      pressureRadius: 2,
      sackRadius: 1,
      ballSpeed: 18,
      inaccuracyK: 0.2, // tuned per D-20/D-22
      catchRadius: 1,
      contestRadius: 1,
      intShare: 0.4,
      contestShareExponent: 1,
      separationTight: 1,
      separationOpen: 2.5,
      wTag: 0.2,
      wSim: 0.7,
      wMis: 0.1,
      suggestRuns: 30,
      assumedDefenderSpeed: 7,
      assumedDefenderReaction: 0.3,
      readWindowLead: 0.3,
      readWindowMin: 0.45,
      scoreSepFull: 4,
      scoreGainFull: 15,
      wScoreSep: 0.6,
      wScoreGain: 0.25,
      wScoreRisk: 0.15,
      laneRadius: 1.5,
      scoreThrow: 55,
    });
  });
});

describe('DEFAULT_PRESETS (SRS §7.1)', () => {
  it('has weak/avg/good values for the headline stats', () => {
    const pick = (k: 'speed' | 'accel' | 'release' | 'armRange') => [
      DEFAULT_PRESETS.weak[k],
      DEFAULT_PRESETS.avg[k],
      DEFAULT_PRESETS.good[k],
    ];
    expect(pick('speed')).toEqual([6, 7, 8]);
    expect(pick('accel')).toEqual([1.2, 0.9, 0.6]);
    expect(pick('release')).toEqual([0.6, 0.45, 0.3]);
    expect(pick('armRange')).toEqual([20, 30, 40]);
  });

  it('defines every stat key as a finite number', () => {
    for (const preset of Object.values(DEFAULT_PRESETS)) {
      for (const k of STAT_KEYS) expect(Number.isFinite(preset[k])).toBe(true);
    }
  });
});

describe('createDefaultRoutePriors (SRS §8.7)', () => {
  const priors = createDefaultRoutePriors();

  it('has a row for every alignment key', () => {
    expect(Object.keys(priors).sort()).toEqual([...ROUTE_PRIOR_KEYS].sort());
  });

  it.each([...ROUTE_PRIOR_KEYS])('row %s is complete, positive and sums to 1', (key) => {
    const row = priors[key] ?? {};
    expect(Object.keys(row).sort()).toEqual([...TEMPLATE_IDS].sort());
    for (const v of Object.values(row)) expect(v).toBeGreaterThan(0);
    expect(Object.values(row).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('shapes rows sensibly', () => {
    const top = (key: string) => Object.entries(priors[key] ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    expect(top('n1-wide')).toBe('go');
    expect(top('n1-tight')).toBe('go');
    expect(top('n2-slot')).toBe('out');
    expect(top('n3')).toBe('drag');
    expect(top('rb')).toBe('flat');
    expect(priors['n1-tight']?.['out'] ?? 0).toBeLessThan(priors['n1-wide']?.['out'] ?? 0);
    expect(priors['rb']?.['wheel'] ?? 0).toBeGreaterThan(priors['n1-wide']?.['wheel'] ?? 1);
  });

  it('returns independent objects on each call', () => {
    const a = createDefaultRoutePriors();
    const b = createDefaultRoutePriors();
    (a['rb'] as Record<string, number>)['flat'] = 0;
    expect(b['rb']?.['flat']).toBeGreaterThan(0);
  });
});

describe('createDefaultSettings', () => {
  it('has the expected shape', () => {
    const s = createDefaultSettings();
    expect(s.key).toBe('app');
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.defaultFormat).toBe('5v5');
    expect(Object.keys(s.fields).sort()).toEqual(['5v5', '7v7', 'custom']);
    expect(s.presets).toEqual(DEFAULT_PRESETS);
    expect(s.tuning).toEqual(DEFAULT_TUNING);
    expect(s.routePriors).toEqual(createDefaultRoutePriors());
    expect(s.ui).toEqual({ theme: 'system', snap: true, showGrid: false });
    expect(s.lastExportAt).toBeUndefined();
  });

  it('two calls are independent', () => {
    const a = createDefaultSettings();
    const b = createDefaultSettings();
    a.presets.avg.speed = 1;
    a.tuning.maxTime = 1;
    a.ui.snap = false;
    (a.routePriors['rb'] as Record<string, number>)['flat'] = 0;
    a.fields['5v5'].noRunZones.length = 0;
    expect(b.presets.avg.speed).toBe(DEFAULT_PRESETS.avg.speed);
    expect(b.tuning.maxTime).toBe(DEFAULT_TUNING.maxTime);
    expect(b.ui.snap).toBe(true);
    expect(b.routePriors['rb']?.['flat']).toBeGreaterThan(0);
    expect(DEFAULT_PRESETS.avg.speed).toBe(7);
  });
});
