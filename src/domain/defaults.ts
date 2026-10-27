/** Default TuningParams (SRS §11.2), route priors (§8.7) and Settings (§5.6). */
import { createDefaultFields } from './field';
import { DEFAULT_PRESETS } from './presets';
import { SCHEMA_VERSION } from './types';
import type { Preset, RoutePriorTable, Settings, Stats, TuningParams } from './types';

export const DEFAULT_TUNING: Readonly<TuningParams> = {
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
  inaccuracyK: 0.3, // tuned (D-20, D-22, D-24); SRS starting value 0.05
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
};

/**
 * Alignment keys used by the route prior (§8.7):
 * - 'n1-wide'  : #1 receiver with > 6 yd to its sideline
 * - 'n1-tight' : #1 receiver with ≤ 6 yd to its sideline
 * - 'n2-slot'  : #2 receiver
 * - 'n3'       : #3 receiver (incl. the C when numbered)
 * - 'rb'       : backfield RB
 * Each row maps every route-tree templateId to a probability; rows sum to 1.
 */
export const ROUTE_PRIOR_KEYS = ['n1-wide', 'n1-tight', 'n2-slot', 'n3', 'rb'] as const;
export type RoutePriorKey = (typeof ROUTE_PRIOR_KEYS)[number];

/** Every route-tree templateId (kept local so defaults.ts does not depend on routeTree.ts). */
const ROUTE_TEMPLATE_IDS = [
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
] as const;

/** Raw (unnormalised) weights per alignment; unlisted routes get a small floor weight. */
const RAW_ROUTE_WEIGHTS: Record<
  RoutePriorKey,
  Partial<Record<(typeof ROUTE_TEMPLATE_IDS)[number], number>>
> = {
  'n1-wide': {
    go: 20,
    hitch: 14,
    slant: 12,
    out: 12,
    comeback: 10,
    curl: 10,
    post: 6,
    corner: 5,
    'out-and-up': 3,
    sluggo: 2,
  },
  'n1-tight': {
    go: 20,
    slant: 18,
    hitch: 14,
    in: 12,
    post: 10,
    curl: 8,
    comeback: 5,
    out: 3,
    corner: 2,
    sluggo: 2,
  },
  'n2-slot': {
    out: 16,
    corner: 14,
    in: 14,
    drag: 12,
    whip: 8,
    flat: 8,
    curl: 8,
    slant: 6,
    post: 5,
    hitch: 4,
    go: 3,
    sluggo: 2,
  },
  n3: { drag: 22, flat: 20, in: 14, curl: 12, out: 10, hitch: 8, whip: 6, slant: 4, wheel: 2, go: 2 },
  rb: { flat: 30, wheel: 20, drag: 14, out: 12, hitch: 6, whip: 6, curl: 4, slant: 3, go: 2 },
};

const FLOOR_WEIGHT = 0.5;

/** Default route prior table. Every row has all route-tree templateIds and sums to 1. */
export function createDefaultRoutePriors(): RoutePriorTable {
  const table: RoutePriorTable = {};
  for (const key of ROUTE_PRIOR_KEYS) {
    const raw = RAW_ROUTE_WEIGHTS[key];
    const weights = ROUTE_TEMPLATE_IDS.map((id) => raw[id] ?? FLOOR_WEIGHT);
    const total = weights.reduce((a, b) => a + b, 0);
    const row: Record<string, number> = {};
    ROUTE_TEMPLATE_IDS.forEach((id, i) => {
      row[id] = (weights[i] ?? FLOOR_WEIGHT) / total;
    });
    table[key] = row;
  }
  return table;
}

function copyPresets(src: Readonly<Record<Preset, Stats>>): Record<Preset, Stats> {
  return { weak: { ...src.weak }, avg: { ...src.avg }, good: { ...src.good } };
}

/** Fresh default Settings record (fields, presets, tuning, priors, ui). */
export function createDefaultSettings(): Settings {
  return {
    key: 'app',
    schemaVersion: SCHEMA_VERSION,
    fields: createDefaultFields(),
    defaultFormat: '5v5',
    presets: copyPresets(DEFAULT_PRESETS),
    tuning: { ...DEFAULT_TUNING },
    routePriors: createDefaultRoutePriors(),
    ui: { theme: 'system', snap: true, showGrid: false, advanced: false },
  };
}

/**
 * Fill keys missing from a stored Settings record with defaults (tuning params, preset stats, field
 * configs, route-prior rows, ui), so settings saved by an older app version keep working after new
 * parameters are added (D-22). Existing values always win. Returns a new object.
 */
export function normalizeSettings(stored: Settings): Settings {
  const d = createDefaultSettings();
  const presets = { ...d.presets };
  for (const k of Object.keys(d.presets) as (keyof Settings['presets'])[]) {
    presets[k] = { ...d.presets[k], ...stored.presets?.[k] };
  }
  const fields = { ...d.fields };
  for (const k of Object.keys(d.fields) as (keyof Settings['fields'])[]) {
    fields[k] = { ...d.fields[k], ...stored.fields?.[k] };
  }
  return {
    ...d,
    ...stored,
    presets,
    fields,
    tuning: { ...d.tuning, ...stored.tuning },
    routePriors: { ...d.routePriors, ...stored.routePriors },
    ui: { ...d.ui, ...stored.ui },
  };
}
