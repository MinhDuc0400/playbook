/** Settings → Tuning: one slider + number per TuningParams key (FR-TUN-01, SRS §11). */
import { Button } from '@/components/ui';
import { settingsRepo } from '@/db/repos';
import { useSettings } from '@/db/hooks';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { TuningParams } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useDraft } from './useDebouncedNumber';

interface Range {
  min: number;
  max: number;
  step: number;
}

export const TUNING_RANGES: Record<Exclude<keyof TuningParams, 'simDt'>, Range> = {
  maxTime: { min: 3, max: 15, step: 0.5 },
  lookahead: { min: 0, max: 1, step: 0.05 },
  tellWindow: { min: 0, max: 1, step: 0.05 },
  leverageOffset: { min: 0, max: 3, step: 0.1 },
  leverageReactionFactor: { min: 0, max: 1, step: 0.01 },
  zoneBuffer: { min: 0, max: 6, step: 0.5 },
  eyeDriftFactor: { min: 0, max: 1, step: 0.01 },
  throwOpenThreshold: { min: 0, max: 5, step: 0.1 },
  pressureRadius: { min: 0.5, max: 6, step: 0.5 },
  sackRadius: { min: 0.25, max: 3, step: 0.25 },
  ballSpeed: { min: 8, max: 30, step: 0.5 },
  inaccuracyK: { min: 0, max: 1, step: 0.01 },
  catchRadius: { min: 0.25, max: 3, step: 0.25 },
  contestRadius: { min: 0.25, max: 3, step: 0.25 },
  intShare: { min: 0, max: 1, step: 0.01 },
  contestShareExponent: { min: 0.25, max: 4, step: 0.25 },
  separationTight: { min: 0, max: 3, step: 0.1 },
  separationOpen: { min: 0.5, max: 6, step: 0.1 },
  wTag: { min: 0, max: 1, step: 0.01 },
  wSim: { min: 0, max: 1, step: 0.01 },
  wMis: { min: 0, max: 1, step: 0.01 },
  suggestRuns: { min: 5, max: 100, step: 1 },
};

async function patchTuning(patch: Partial<TuningParams>): Promise<void> {
  const cur = await settingsRepo.getOrDefault();
  await settingsRepo.update({ tuning: { ...cur.tuning, ...patch } });
}

function Row({ name, value }: { name: Exclude<keyof TuningParams, 'simDt'>; value: number }): JSX.Element {
  const r = TUNING_RANGES[name];
  const { draft, set, revert } = useDraft(value, (v) => {
    if (v >= r.min && v <= r.max) void patchTuning({ [name]: v });
  });
  const label = t.tuning.params[name];
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`tuning-row-${name}`}>
      <span className="w-full text-sm font-medium sm:w-72">{label}</span>
      <input
        type="range"
        aria-label={label}
        data-testid={`tuning-slider-${name}`}
        min={r.min}
        max={r.max}
        step={r.step}
        value={Number.isFinite(Number(draft)) ? draft : value}
        onChange={(e) => set(e.target.value)}
        className="min-w-32 flex-1"
      />
      <input
        type="number"
        data-testid={`tuning-${name}`}
        aria-label={`${label} (số)`}
        min={r.min}
        max={r.max}
        step={r.step}
        value={draft}
        onChange={(e) => set(e.target.value)}
        onBlur={revert}
        className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
      />
      <Button
        size="sm"
        variant="ghost"
        data-testid={`tuning-reset-${name}`}
        onClick={() => void patchTuning({ [name]: DEFAULT_TUNING[name] })}
      >
        {t.tuning.resetOne}
      </Button>
    </div>
  );
}

export function TuningSection(): JSX.Element {
  const settings = useSettings();
  const tuning = settings?.tuning ?? DEFAULT_TUNING;
  const names = Object.keys(TUNING_RANGES) as (keyof typeof TUNING_RANGES)[];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t.tuning.tuningIntro}</p>
      <div>
        <Button
          data-testid="tuning-reset"
          onClick={() => void settingsRepo.update({ tuning: { ...DEFAULT_TUNING } })}
        >
          {t.tuning.resetAll}
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" data-testid="tuning-row-simDt">
          <span className="w-full text-sm font-medium sm:w-72">{t.tuning.params.simDt}</span>
          <span data-testid="tuning-simDt">1/60 ({t.tuning.readOnly})</span>
        </div>
        {names.map((n) => (
          <Row key={n} name={n} value={tuning[n]} />
        ))}
      </div>
    </div>
  );
}
