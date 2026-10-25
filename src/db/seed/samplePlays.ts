/**
 * Sample 5v5 plays seeded on first open (FR-DAT-05, D-01, D-16).
 * Fixed ids so tests, E2E and the tuning benchmark can reference them.
 */
import { notImplemented } from '@/domain/notImplemented';
import type { Play } from '@/domain/types';

export const SEED_IDS = {
  flood: 'seed-off-trips-flood',
  mesh: 'seed-off-mesh',
  smash: 'seed-off-smash',
  cover1: 'seed-def-cover-1',
  cover2: 'seed-def-cover-2',
  cover3: 'seed-def-cover-3',
} as const;

/** 3 offense + 3 defense 5v5 plays, timestamps = now. */
export function createSamplePlays(now: number): Play[] {
  return notImplemented(`createSamplePlays ${now}`);
}
