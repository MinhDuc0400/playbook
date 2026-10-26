/** FR-MU-07: outcome, target, yards, time to throw, separation at throw per receiver, open-window bars. */
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Play, SimResult, TuningParams } from '@/domain/types';
import { t } from '@/i18n/vi';
import { decisionText } from './ReadTimeline';

export interface ResultPanelProps {
  result: SimResult;
  offense: Play; // for labels
  /** Current playhead, drawn on the open-window bars. */
  t: number;
  /** Thresholds for separation colours; defaults to DEFAULT_TUNING. */
  tuning?: TuningParams;
}

const s = t.result;

function sepClass(d: number, tuning: TuningParams): string {
  if (d < tuning.separationTight) return 'text-red-600';
  if (d <= tuning.separationOpen) return 'text-amber-600';
  return 'text-green-600';
}

function pct(v: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (v / total) * 100));
}

export function ResultPanel({
  result,
  offense,
  t: playhead,
  tuning = DEFAULT_TUNING,
}: ResultPanelProps): JSX.Element {
  const { outcome, metrics, frames } = result;
  const total = frames.length > 0 ? frames[frames.length - 1]!.t : 0;
  const labelOf = (id: string) => offense.players.find((p) => p.id === id)?.label ?? id;
  const receivers = offense.players.filter((p) => p.role !== 'QB');
  const hasTarget = 'targetId' in outcome;
  const ttt = metrics.timeToThrow;

  return (
    <section data-testid="result-panel" className="space-y-3 rounded border p-3 text-sm">
      <h2 className="font-semibold">{s.title}</h2>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span data-testid="result-outcome" className="text-base font-semibold">
          {s.outcome[outcome.kind]}
        </span>
        {hasTarget && (
          <span>
            {s.target}: <span data-testid="result-target">{labelOf(outcome.targetId)}</span>
          </span>
        )}
        {outcome.kind === 'complete' && (
          <span>
            {s.yards}: <span data-testid="result-yards">{outcome.yards.toFixed(1)}</span> {s.yardsUnit}
          </span>
        )}
        <span data-testid="result-outcome-time">
          {s.outcomeTime}: {outcome.t.toFixed(2)} {s.secondsUnit}
        </span>
      </div>
      {metrics.reads && (
        <div>
          {s.decision}: <span data-testid="result-decision">{decisionText(metrics.reads, labelOf)}</span>
        </div>
      )}
      <div>
        {s.timeToThrow}:{' '}
        <span data-testid="result-ttt">
          {ttt === undefined ? s.none : `${ttt.toFixed(2)} ${s.secondsUnit}`}
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th>{s.receiver}</th>
            <th>{s.separationAtThrow}</th>
            <th className="w-1/2">{s.openWindow}</th>
          </tr>
        </thead>
        <tbody>
          {receivers.map((p) => {
            const sep = metrics.separationAtThrow?.[p.id];
            const windows = metrics.openWindows[p.id] ?? [];
            return (
              <tr key={p.id} data-testid={`result-row-${p.label}`}>
                <td>{p.label}</td>
                <td data-testid="result-sep" className={sep === undefined ? '' : sepClass(sep, tuning)}>
                  {sep === undefined ? s.none : sep.toFixed(1)}
                </td>
                <td>
                  <div className="relative h-3 rounded bg-gray-200">
                    {windows.map(([a, b], i) => (
                      <div
                        key={i}
                        data-testid="open-window"
                        className="absolute top-0 h-full bg-green-500"
                        style={{
                          left: `${pct(a, total)}%`,
                          width: `${pct(Math.max(0, b - a), total)}%`,
                        }}
                      />
                    ))}
                    <div
                      data-testid="playhead"
                      className="absolute top-0 h-full w-px bg-black"
                      style={{ left: `${pct(playhead, total)}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
