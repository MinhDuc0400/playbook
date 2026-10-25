import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import {
  useAllTags,
  useInstall,
  useMatchupBundle,
  useMatchupCountByPlay,
  usePlay,
  usePlays,
  useSettings,
} from '../hooks';
import { installsRepo, matchupsRepo, playsRepo, settingsRepo } from '../repos';
import { resetDb } from '../schema';
import { makeInstall, makeMatchup, makePlay } from './fixtures';

beforeEach(async () => {
  await resetDb();
});

describe('db hooks', () => {
  it('usePlays starts undefined, then lists, then updates after a put', async () => {
    const { result } = renderHook(() => usePlays());
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toEqual([]));
    await act(async () => {
      await playsRepo.put(makePlay('p1'));
    });
    await waitFor(() => expect(result.current?.map((p) => p.id)).toEqual(['p1']));
  });

  it('usePlay returns null for an unknown id and the play once it exists', async () => {
    const { result } = renderHook(() => usePlay('p1'));
    await waitFor(() => expect(result.current).toBeNull());
    await act(async () => {
      await playsRepo.put(makePlay('p1'));
    });
    await waitFor(() => expect(result.current?.id).toBe('p1'));
  });

  it('usePlay / useInstall with undefined id → null', () => {
    expect(renderHook(() => usePlay(undefined)).result.current).toBeNull();
    expect(renderHook(() => useInstall(undefined)).result.current).toBeNull();
  });

  it('useInstall null for unknown, record when present', async () => {
    await installsRepo.put(makeInstall('i1', []));
    const known = renderHook(() => useInstall('i1'));
    const unknown = renderHook(() => useInstall('zzz'));
    await waitFor(() => expect(known.result.current?.id).toBe('i1'));
    await waitFor(() => expect(unknown.result.current).toBeNull());
  });

  it('useAllTags and useMatchupCountByPlay react to writes', async () => {
    const tags = renderHook(() => useAllTags());
    const counts = renderHook(() => useMatchupCountByPlay());
    await act(async () => {
      await playsRepo.put(makePlay('p1', { tags: ['b', 'a'] }));
      await matchupsRepo.put(makeMatchup('m1', 'p1', 'd1'));
    });
    await waitFor(() => expect(tags.result.current).toEqual(['a', 'b']));
    await waitFor(() => expect(counts.result.current).toEqual({ p1: 1, d1: 1 }));
  });

  it('useMatchupBundle reports missing-play without crashing (FR-DAT-03)', async () => {
    await matchupsRepo.put(makeMatchup('m1', 'o1', 'd1'));
    const { result } = renderHook(() => useMatchupBundle('m1'));
    await waitFor(() => expect(result.current?.status).toBe('missing-play'));
    expect(renderHook(() => useMatchupBundle(undefined)).result.current).toBeUndefined();
  });

  it('useSettings returns defaults, then stored settings after an update', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current).toEqual(createDefaultSettings()));
    await act(async () => {
      await settingsRepo.update({ defaultFormat: '7v7' });
    });
    await waitFor(() => expect(result.current?.defaultFormat).toBe('7v7'));
  });
});
