/** Matchup screen UI state (overlays, selection). Playback lives in usePlayback. */
import { create } from 'zustand';
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

const defaultOverlays = (): Record<OverlayKey, boolean> => ({
  plannedRoutes: true,
  trails: false,
  zones: true,
  manLines: true,
  ballPath: true,
  separation: true,
});

export const useMatchupStore: MatchupStoreHook = create<MatchupUiState>()((set) => ({
  overlays: defaultOverlays(),
  selected: null,
  toggleOverlay: (k) => set((s) => ({ overlays: { ...s.overlays, [k]: !s.overlays[k] } })),
  setOverlay: (k, v) => set((s) => ({ overlays: { ...s.overlays, [k]: v } })),
  select: (selected) => set({ selected }),
  reset: () => set({ overlays: defaultOverlays(), selected: null }),
}));
