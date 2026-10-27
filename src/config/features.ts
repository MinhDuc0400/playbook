/**
 * Feature flags (D-26). "Simple mode" is the default; `Settings.ui.advanced = true` shows everything.
 * Components read these flags and do not mount hidden panels.
 */
import { useSettings } from '@/db/hooks';

export interface Features {
  /** Master switch (Settings → "Chế độ nâng cao"). */
  advanced: boolean;
  /** Roster screen, lineups, Kém/TB/Hay, stat sliders, token level rings, custom-stats notes. */
  showStats: boolean;
  /** "Chạy 50 lần", Benchmark, Suggest (simulation tier), outcome statistics. */
  showSimulationStats: boolean;
  /** Read plan editor, read timeline / score chart, "QB tự ném". */
  showReadModel: boolean;
  /** Seed dice, noise, ball spot, anticipation, Random defense. */
  showMatchupTuning: boolean;
  /** Settings sections: field config, presets, tuning, benchmark. */
  showTuningSettings: boolean;
  /** Nav entries / routes. */
  showRoster: boolean;
  showSuggest: boolean;
}

export function featuresFor(advanced: boolean): Features {
  return {
    advanced,
    showStats: advanced,
    showSimulationStats: advanced,
    showReadModel: advanced,
    showMatchupTuning: advanced,
    showTuningSettings: advanced,
    showRoster: advanced,
    showSuggest: advanced,
  };
}

let override: boolean | null = null;

/** Tests only: force Simple (false) / Advanced (true) regardless of stored settings; null = use settings. */
export function setFeatureOverride(advanced: boolean | null): void {
  override = advanced;
}

/** Current flags from the stored settings; Simple mode while settings are loading. */
export function useFeatures(): Features {
  const settings = useSettings();
  return featuresFor(override ?? settings?.ui.advanced === true);
}
