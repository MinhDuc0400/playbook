import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { createDefaultSettings } from '@/domain/defaults';
import type { DbSnapshot } from '@/domain/types';
import { createMatchup } from '../buildSimInput';
import { useMatchupSim } from '../useMatchupSim';

const plays = createSamplePlays(1);
const mesh = plays.find((p) => p.id === SEED_IDS.mesh)!;
const cover1 = plays.find((p) => p.id === SEED_IDS.cover1)!;
const snap: DbSnapshot = { settings: createDefaultSettings(), lineups: {}, athletes: {} };
const m = createMatchup({ offensePlayId: mesh.id, defensePlayId: cover1.id, now: 1, idGen: () => 'm' });

describe('useMatchupSim', () => {
  it('returns all null for null inputs', () => {
    const { result } = renderHook(() => useMatchupSim(null, mesh, cover1, snap));
    expect(result.current).toEqual({ built: null, result: null, error: null });
  });

  it('simulates, memoizes by reference, and reruns on a new matchup', () => {
    const { result, rerender } = renderHook((p: { m: typeof m }) => useMatchupSim(p.m, mesh, cover1, snap), {
      initialProps: { m },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.result?.outcome).toBeDefined();
    const first = result.current;
    rerender({ m });
    expect(result.current).toBe(first);
    rerender({ m: { ...m, seed: m.seed + 1 } });
    expect(result.current).not.toBe(first);
    expect(result.current.built?.input.seed).toBe(m.seed + 1);
  });

  it('captures build errors instead of throwing', () => {
    const bad = { ...snap, settings: { ...snap.settings, fields: {} } } as unknown as DbSnapshot;
    const { result } = renderHook(() => useMatchupSim(m, mesh, cover1, bad));
    expect(result.current.result).toBeNull();
    expect(typeof result.current.error).toBe('string');
  });

  it('requests debug data only when the debug flag is set', () => {
    const off = renderHook(() => useMatchupSim(m, mesh, cover1, snap));
    expect(off.result.current.result?.debug).toBeUndefined();
    const on = renderHook(() => useMatchupSim(m, mesh, cover1, snap, true));
    expect(on.result.current.result?.debug?.defenders.length).toBe(on.result.current.result?.frames.length);
  });
});
