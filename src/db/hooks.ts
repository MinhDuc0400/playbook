/**
 * Live-query hooks for components (dexie-react-hooks useLiveQuery over the repositories).
 * Each returns undefined while loading.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import type { Athlete, DbSnapshot, ID, Install, Lineup, Matchup, Play, Settings } from '@/domain/types';
import { athletesRepo } from './repos/athletes';
import { loadDbSnapshot, loadMatchupBundle, type MatchupBundle } from './repos/bundle';
import { installsRepo } from './repos/installs';
import { lineupsRepo } from './repos/lineups';
import { matchupsRepo } from './repos/matchups';
import { playsRepo } from './repos/plays';
import { settingsRepo } from './repos/settings';

export function usePlays(): Play[] | undefined {
  return useLiveQuery(() => playsRepo.list(), []);
}
/** null when the play does not exist. */
export function usePlay(id: ID | undefined): Play | null | undefined {
  const found = useLiveQuery(
    async () => (id === undefined ? null : ((await playsRepo.get(id)) ?? null)),
    [id],
  );
  return id === undefined ? null : found;
}
export function useAllTags(): string[] | undefined {
  return useLiveQuery(() => playsRepo.allTags(), []);
}
export function useMatchups(): Matchup[] | undefined {
  return useLiveQuery(() => matchupsRepo.list(), []);
}
export function useMatchupBundle(id: ID | undefined): MatchupBundle | undefined {
  const bundle = useLiveQuery(async () => (id === undefined ? undefined : await loadMatchupBundle(id)), [id]);
  return id === undefined ? undefined : bundle;
}
export function useMatchupCountByPlay(): Record<ID, number> | undefined {
  return useLiveQuery(() => matchupsRepo.countByPlay(), []);
}
export function useInstalls(): Install[] | undefined {
  return useLiveQuery(() => installsRepo.list(), []);
}
/** null when the install does not exist. */
export function useInstall(id: ID | undefined): Install | null | undefined {
  const found = useLiveQuery(
    async () => (id === undefined ? null : ((await installsRepo.get(id)) ?? null)),
    [id],
  );
  return id === undefined ? null : found;
}
export function useAthletes(): Athlete[] | undefined {
  return useLiveQuery(() => athletesRepo.list(), []);
}
export function useLineups(): Lineup[] | undefined {
  return useLiveQuery(() => lineupsRepo.list(), []);
}
/** Stored settings or defaults. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => settingsRepo.getOrDefault(), []);
}
export function useDbSnapshot(): DbSnapshot | undefined {
  return useLiveQuery(() => loadDbSnapshot(), []);
}
