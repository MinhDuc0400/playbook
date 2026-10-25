/** Seeded RNG (NFR-ARC-02, D-10). Pure. */
import type { Rng } from './types';

/** mulberry32 core: one 32-bit state word, floats in [0, 1). */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** cyrb53 string hash with a numeric seed; returns a 32-bit unsigned integer. */
function hashString(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Deterministic PRNG (mulberry32 or sfc32) seeded by a 32-bit integer; floats in [0, 1). */
export function createRng(seed: number): Rng {
  return mulberry32(seed | 0);
}

/** Independent stream for `key` derived from (seed, key) via a string hash (e.g. cyrb53/FNV-1a). */
export function forkRng(seed: number, key: string): Rng {
  return mulberry32(hashString(key, seed | 0));
}

/** Standard normal sample (Box–Muller) from rng. */
export function gaussian(rng: Rng): number {
  const u1 = 1 - rng(); // (0, 1] so log() never sees 0
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Uniform float in [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
