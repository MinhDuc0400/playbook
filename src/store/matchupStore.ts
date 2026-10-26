/** Matchup screen UI state (overlays, selection). Playback lives in usePlayback. */
import { create } from 'zustand';
import type { ID, Side } from '@/domain/types';

export type OverlayKey =
  'plannedRoutes' | 'trails' | 'zones' | 'manLines' | 'ballPath' | 'separation' | 'perception' | 'qbEyes';

export interface MatchupUiState {
  /** FR-MU-05 / FR-MU-06 toggles; all true by default except trails (false). */
  overlays: Record<OverlayKey, boolean>;
  /** Defender whose perception is drawn by the perception overlay (FR-MU-11). */
  debugDefenderId: ID | null;
  selected: { side: Side; slotId: ID; label: string } | null;
  toggleOverlay(k: OverlayKey): void;
  setOverlay(k: OverlayKey, v: boolean): void;
  select(sel: MatchupUiState['selected']): void;
  setDebugDefender(id: ID | null): void;
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
  perception: false,
  qbEyes: true,
});

export const useMatchupStore: MatchupStoreHook = create<MatchupUiState>()((set) => ({
  overlays: defaultOverlays(),
  selected: null,
  debugDefenderId: null,
  toggleOverlay: (k) => set((s) => ({ overlays: { ...s.overlays, [k]: !s.overlays[k] } })),
  setOverlay: (k, v) => set((s) => ({ overlays: { ...s.overlays, [k]: v } })),
  select: (selected) =>
    set((s) => ({
      selected,
      debugDefenderId:
        selected?.side === 'defense' && s.overlays.perception ? selected.slotId : s.debugDefenderId,
    })),
  setDebugDefender: (debugDefenderId) => set({ debugDefenderId }),
  reset: () => set({ overlays: defaultOverlays(), selected: null, debugDefenderId: null }),
}));
