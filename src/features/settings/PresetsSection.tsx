/** Settings → Preset: Kém / TB / Hay stat table (FR-TUN-02, SRS §7.1). */
import { Button } from '@/components/ui';
import { settingsRepo } from '@/db/repos';
import { useSettings } from '@/db/hooks';
import { DEFAULT_PRESETS, PRESET_IDS } from '@/domain/presets';
import type { Preset, Stats } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useDraft } from './useDebouncedNumber';

interface Range {
  min: number;
  max: number;
}
const UNIT: Range = { min: 0, max: 1 };
export const STAT_RANGES: Record<keyof Stats, Range> = {
  speed: { min: 3, max: 12 },
  accel: { min: 0.2, max: 3 },
  cutLoss: UNIT,
  reaction: { min: 0.05, max: 1.5 },
  iq: UNIT,
  hands: UNIT,
  ballSkills: UNIT,
  release: { min: 0.1, max: 1.5 },
  accuracy: UNIT,
  armRange: { min: 5, max: 60 },
  eyeDiscipline: UNIT,
};
const STAT_ORDER = Object.keys(STAT_RANGES) as (keyof Stats)[];

async function patchPreset(preset: Preset, stat: keyof Stats, v: number): Promise<void> {
  const cur = await settingsRepo.getOrDefault();
  await settingsRepo.update({
    presets: { ...cur.presets, [preset]: { ...cur.presets[preset], [stat]: v } },
  });
}

function Cell({ preset, stat, value }: { preset: Preset; stat: keyof Stats; value: number }): JSX.Element {
  const r = STAT_RANGES[stat];
  const { draft, set, revert } = useDraft(value, (v) => {
    if (v >= r.min && v <= r.max) void patchPreset(preset, stat, v);
  });
  return (
    <input
      type="number"
      data-testid={`preset-${preset}-${stat}`}
      aria-label={`${t.tuning.presets[preset]} ${t.tuning.presets.stats[stat]}`}
      min={r.min}
      max={r.max}
      step={r.max <= 1 ? 0.05 : 0.1}
      value={draft}
      onChange={(e) => set(e.target.value, true)}
      onBlur={revert}
      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
    />
  );
}

export function PresetsSection(): JSX.Element {
  const settings = useSettings();
  const presets = settings?.presets ?? DEFAULT_PRESETS;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t.tuning.presets.intro}</p>
      <div>
        <Button
          data-testid="presets-reset"
          onClick={() =>
            void settingsRepo.update({
              presets: {
                weak: { ...DEFAULT_PRESETS.weak },
                avg: { ...DEFAULT_PRESETS.avg },
                good: { ...DEFAULT_PRESETS.good },
              },
            })
          }
        >
          {t.tuning.presets.reset}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left">
              <th className="pr-4">{t.tuning.presets.stat}</th>
              {PRESET_IDS.map((p) => (
                <th key={p} className="pr-2">
                  {t.tuning.presets[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAT_ORDER.map((stat) => (
              <tr key={stat}>
                <td className="pr-4">{t.tuning.presets.stats[stat]}</td>
                {PRESET_IDS.map((p) => (
                  <td key={p} className="pr-2 py-0.5">
                    <Cell preset={p} stat={stat} value={presets[p][stat]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
