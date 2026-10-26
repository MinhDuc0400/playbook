/** FR-MU-13: "Chạy 50 lần" in the Worker — % complete, target distribution, avg yards, % sack, % int. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import type { AggregateResult, SimInput } from '@/domain/types';
import { t } from '@/i18n/vi';
import { runMany, type RunManyHandle } from '@/workers/simClient';

export interface RunManyPanelProps {
  input: SimInput;
  /** slot id → label for display */
  labels: Record<string, string>;
}

const s = t.matchup.runMany;
const RUNS = 50;
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

interface Done {
  key: string;
  result: AggregateResult;
}

export function RunManyPanel({ input, labels }: RunManyPanelProps): JSX.Element {
  // Content key so a re-built but identical input (e.g. debug toggle) does not mark results stale.
  const key = useMemo(() => JSON.stringify(input), [input]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const handle = useRef<RunManyHandle | null>(null);

  useEffect(
    () => () => {
      const h = handle.current;
      handle.current = null;
      h?.cancel();
      h?.promise.catch(() => undefined);
    },
    [],
  );

  const start = (): void => {
    handle.current?.cancel();
    setMessage(null);
    setProgress({ done: 0, total: RUNS });
    const h = runMany(input, RUNS, (d, total) => {
      if (handle.current === h) setProgress({ done: d, total });
    });
    handle.current = h;
    const runKey = key;
    h.promise.then(
      (result) => {
        if (handle.current !== h) return;
        handle.current = null;
        setProgress(null);
        setDone({ key: runKey, result });
      },
      (e: unknown) => {
        if (handle.current !== h) return;
        handle.current = null;
        setProgress(null);
        setMessage(e instanceof DOMException && e.name === 'AbortError' ? s.cancelled : s.failed);
      },
    );
  };

  const cancel = (): void => {
    handle.current?.cancel();
  };

  const running = progress !== null;
  const r = done?.result;
  const stale = done !== null && done.key !== key;

  return (
    <section data-testid="run-many-panel" className="flex flex-col gap-2 rounded border p-3 text-sm">
      <h2 className="font-semibold">{s.title}</h2>
      <div className="flex items-center gap-2">
        <Button data-testid="run-many" size="sm" variant="primary" disabled={running} onClick={start}>
          {s.run}
        </Button>
        {running && (
          <>
            <span data-testid="run-many-progress">{s.progress(progress.done, progress.total)}</span>
            <Button data-testid="run-many-cancel" size="sm" onClick={cancel}>
              {s.cancel}
            </Button>
          </>
        )}
      </div>
      {message !== null && (
        <p data-testid="run-many-message" role="status">
          {message}
        </p>
      )}
      {r && (
        <div
          data-testid="run-many-result"
          data-stale={stale ? 'true' : undefined}
          className="flex flex-col gap-1"
        >
          {stale && (
            <p
              data-testid="run-many-stale"
              className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100"
            >
              {s.stale}
            </p>
          )}
          <dl className={`grid grid-cols-2 gap-x-2 ${stale ? 'opacity-60' : ''}`}>
            <dt>{s.pComplete}</dt>
            <dd data-testid="run-many-pcomplete">{pct(r.pComplete)}</dd>
            <dt>{s.pSack}</dt>
            <dd data-testid="run-many-psack">{pct(r.pSack)}</dd>
            <dt>{s.pInt}</dt>
            <dd data-testid="run-many-pint">{pct(r.pInt)}</dd>
            <dt>{s.avgYards}</dt>
            <dd data-testid="run-many-avgyards">{r.avgYards.toFixed(1)}</dd>
            <dt>{s.avgTimeToThrow}</dt>
            <dd data-testid="run-many-avgttt">
              {r.avgTimeToThrow === null ? s.none : r.avgTimeToThrow.toFixed(2)}
            </dd>
          </dl>
          <h3 className="mt-1 font-medium">{s.targets}</h3>
          <ul className={`flex flex-col gap-1 ${stale ? 'opacity-60' : ''}`}>
            {Object.entries(r.targetDistribution).map(([id, frac]) => {
              const label = labels[id] ?? id;
              return (
                <li key={id} className="flex items-center gap-2">
                  <span className="w-8">{label}</span>
                  <div className="h-3 flex-1 rounded bg-slate-200 dark:bg-slate-700">
                    <div
                      data-testid={`run-many-target-${label}`}
                      data-fraction={frac}
                      className="h-3 rounded bg-blue-600"
                      style={{ width: `${Math.round(frac * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right">{pct(frac)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
