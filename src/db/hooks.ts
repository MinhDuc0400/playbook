/**
 * Live-query hooks for components (dexie-react-hooks useLiveQuery over the repositories).
 * Each returns undefined while loading.
 */
import { notImplemented } from '@/domain/notImplemented';
import type { Athlete, DbSnapshot, ID, Install, Lineup, Matchup, Play, Settings } from '@/domain/types';
import type { MatchupBundle } from './repos/bundle';

export function usePlays(): Play[] | undefined {
  return notImplemented('usePlays');
}
/** null when the play does not exist. */
export function usePlay(id: ID | undefined): Play | null | undefined {
  return notImplemented(`usePlay ${id}`);
}
export function useAllTags(): string[] | undefined {
  return notImplemented('useAllTags');
}
export function useMatchups(): Matchup[] | undefined {
  return notImplemented('useMatchups');
}
export function useMatchupBundle(id: ID | undefined): MatchupBundle | undefined {
  return notImplemented(`useMatchupBundle ${id}`);
}
export function useMatchupCountByPlay(): Record<ID, number> | undefined {
  return notImplemented('useMatchupCountByPlay');
}
export function useInstalls(): Install[] | undefined {
  return notImplemented('useInstalls');
}
/** null when the install does not exist. */
export function useInstall(id: ID | undefined): Install | null | undefined {
  return notImplemented(`useInstall ${id}`);
}
export function useAthletes(): Athlete[] | undefined {
  return notImplemented('useAthletes');
}
export function useLineups(): Lineup[] | undefined {
  return notImplemented('useLineups');
}
/** Stored settings or defaults. */
export function useSettings(): Settings | undefined {
  return notImplemented('useSettings');
}
export function useDbSnapshot(): DbSnapshot | undefined {
  return notImplemented('useDbSnapshot');
}
