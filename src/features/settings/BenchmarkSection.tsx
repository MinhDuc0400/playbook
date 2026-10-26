/** Settings → Benchmark: sample-matchup completion rates (FR-TUN-03, D-16). */
import { useRef, useState } from 'react';
import { Button, Select } from '@/components/ui';
import { useSettings, usePlays } from '@/db/hooks';
import { runBenchmark, type BenchmarkRow } from '@/engine/benchmark';
import { t } from '@/i18n/vi';

const RUN_OPTIONS = [10, 30, 50] as const;
const pct = (p: number): string => `${(p * 100).toFixed(0)} %`;

export function BenchmarkSection(): JSX.Element {
  const settings = useSettings();
  const plays = usePlays();
  const [runs, setRuns] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const cancelRef = useRef(false);

  const start = async (): Promise<void> => {
    if (!settings || !plays) return;
    const seeds = plays.filter((p) => p.id.startsWith('seed-'));
    const pool = seeds.length > 0 ? seeds : plays;
    const offenses = pool.filter((p) => p.side === 'offense');
    const defenses = pool.filter((p) => p.side === 'defense');
    const pairs = offenses.flatMap((o) =>
      defenses.filter((d) => d.format === o.format).map((d) => [o, d] as const),
    );
    if (pairs.length === 0) {
      setProgress(t.tuning.benchmark.noPlays);
      return;
    }
    cancelRef.current = false;
    setRunning(true);
    setRows([]);
    const acc: BenchmarkRow[] = [];
    let cancelled = false;
    for (const [o, d] of pairs) {
      setProgress(t.tuning.benchmark.progress(acc.length, pairs.length));
      await new Promise((r) => setTimeout(r, 0));
      if (cancelRef.current) {
        cancelled = true;
        break;
      }
      acc.push(...runBenchmark([o, d], settings, runs));
      setRows([...acc]);
    }
    setRunning(false);
    setProgress(
      cancelled
        ? t.tuning.benchmark.cancelled(acc.length, pairs.length)
        : t.tuning.benchmark.done(acc.length),
    );
  };

  const c = t.tuning.benchmark.columns;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t.tuning.benchmark.intro}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t.tuning.benchmark.runs}
          data-testid="bench-runs"
          value={runs}
          disabled={running}
          onChange={(e) => setRuns(Number(e.target.value))}
        >
          {RUN_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          data-testid="bench-run"
          disabled={running || !settings || !plays}
          onClick={() => void start()}
        >
          {t.tuning.benchmark.run}
        </Button>
        {running ? (
          <Button data-testid="bench-cancel" onClick={() => (cancelRef.current = true)}>
            {t.tuning.benchmark.cancel}
          </Button>
        ) : null}
      </div>
      <p className="text-sm" data-testid="bench-progress" aria-live="polite">
        {progress}
      </p>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="text-sm" data-testid="bench-table">
            <thead>
              <tr className="text-left">
                <th className="pr-4">{c.offense}</th>
                <th className="pr-4">{c.defense}</th>
                <th className="pr-4">{c.complete}</th>
                <th className="pr-4">{c.sack}</th>
                <th className="pr-4">{c.int}</th>
                <th className="pr-4">{c.yards}</th>
                <th>{c.target}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ok = r.pComplete >= 0.6 && r.pComplete <= 0.7;
                const key = `${r.offenseId}-${r.defenseId}`;
                return (
                  <tr
                    key={key}
                    data-testid={`bench-row-${key}`}
                    data-target={r.target ? 'true' : 'false'}
                    className={r.target ? 'bg-amber-100 font-medium dark:bg-amber-900/40' : ''}
                  >
                    <td className="pr-4">{r.offenseName}</td>
                    <td className="pr-4">{r.defenseName}</td>
                    <td className="pr-4">{pct(r.pComplete)}</td>
                    <td className="pr-4">{pct(r.pSack)}</td>
                    <td className="pr-4">{pct(r.pInt)}</td>
                    <td className="pr-4">{r.avgYards.toFixed(1)}</td>
                    <td data-testid={r.target ? `bench-ok-${key}` : undefined}>
                      {r.target ? (
                        ok ? (
                          <span aria-label={t.tuning.benchmark.ok}>✓</span>
                        ) : (
                          <span aria-label={t.tuning.benchmark.notOk}>✗</span>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
