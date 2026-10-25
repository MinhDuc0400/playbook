/** Seeded RNG (NFR-ARC-02, D-10). Pure. */
import { notImplemented } from '@/domain/notImplemented';
import type { Rng } from './types';

/** Deterministic PRNG (mulberry32 or sfc32) seeded by a 32-bit integer; floats in [0, 1). */
export function createRng(seed: number): Rng {
  return notImplemented(`createRng ${seed}`);
}

/** Independent stream for `key` derived from (seed, key) via a string hash (e.g. cyrb53/FNV-1a). */
export function forkRng(seed: number, key: string): Rng {
  return notImplemented(`forkRng ${seed}${key}`);
}

/** Standard normal sample (Box–Muller) from rng. */
export function gaussian(rng: Rng): number {
  return notImplemented(`gaussian ${String(rng)}`);
}

/** Uniform float in [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return notImplemented(`uniform ${String(rng)}${min}${max}`);
}
