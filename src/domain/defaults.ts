/** Default TuningParams (SRS §11.2), route priors (§8.7) and Settings (§5.6). */
import type { RoutePriorTable, Settings, TuningParams } from './types';

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
  inaccuracyK: 0.05,
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

/** Default route prior table. Every row has all route-tree templateIds and sums to 1. */
export function createDefaultRoutePriors(): RoutePriorTable {
  throw new Error('not implemented');
}

/** Fresh default Settings record (fields, presets, tuning, priors, ui). */
export function createDefaultSettings(): Settings {
  throw new Error('not implemented');
}
