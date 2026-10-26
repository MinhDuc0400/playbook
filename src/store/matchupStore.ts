/** Matchup screen UI state (overlays, selection). Playback lives in usePlayback. */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Side } from '@/domain/types';

export type OverlayKey = 'plannedRoutes' | 'trails' | 'zones' | 'manLines' | 'ballPath' | 'separation';

export interface MatchupUiState {
  /** FR-MU-05 / FR-MU-06 toggles; all true by default except trails (false). */
  overlays: Record<OverlayKey, boolean>;
  selected: { side: Side; slotId: ID; label: string } | null;
  toggleOverlay(k: OverlayKey): void;
  setOverlay(k: OverlayKey, v: boolean): void;
  select(sel: MatchupUiState['selected']): void;
  reset(): void;
}

export interface MatchupStoreHook {
  <T>(selector: (s: MatchupUiState) => T): T;
  getState(): MatchupUiState;
}

export const useMatchupStore: MatchupStoreHook = new Proxy(
  (() => notImplemented('useMatchupStore')) as unknown as MatchupStoreHook,
  {
    get: (_t, key) => notImplemented(`useMatchupStore.${String(key)}`),
  },
);
