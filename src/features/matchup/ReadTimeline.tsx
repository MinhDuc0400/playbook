/**
 * Read timeline (D-22): per receiver the QB read window vs the real open windows, the decision marker,
 * and every receiver's read score over time. Everything is drawn from engine data (NFR-ARC-03).
 */
import { useState } from 'react';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Play, ReadMetrics, SimResult, TuningParams } from '@/domain/types';
import { frameAt } from '@/engine/frames';
import { minScoreFor } from '@/engine/readModel';
import { t as strings } from '@/i18n/vi';

export interface ReadTimelineProps {
  result: SimResult;
  offense: Play;
  /** Playhead (s). */
  t: number;
  tuning?: TuningParams;
}

const s = strings.result.readTimeline;
const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d'];
const CHART_H = 120;
const CHART_W = 1000;

/** Text of the QB decision (marker, result panel). */
export function decisionText(reads: ReadMetrics, labelOf: (id: string) => string): string {
  const d = reads.decision;
  const who = d.targetId === undefined ? '' : labelOf(d.targetId);
  switch (d.kind) {
    case 'read':
      return s.decision.read((d.readIndex ?? 0) + 1, who, d.score);
    case 'checkdown':
      return s.decision.checkdown(who);
    case 'forced':
      return s.decision.forced(who);
    case 'throwaway':
      return s.decision.throwaway;
    case 'none':
      return s.decision.none;
  }
}

export function ReadTimeline({
  result,
  offense,
  t,
  tuning = DEFAULT_TUNING,
}: ReadTimelineProps): JSX.Element | null {
  const [open, setOpen] = useState(true);
  const reads = result.metrics.reads;
  const { frames } = result;
  if (!reads || frames.length === 0) return null;

  const minT = frames[0]!.t;
  const span = frames[frames.length - 1]!.t - minT;
  const pct = (at: number): number => (span > 0 ? Math.min(100, Math.max(0, ((at - minT) / span) * 100)) : 0);
  const labelOf = (id: string): string => offense.players.find((p) => p.id === id)?.label ?? id;

  const receivers = offense.players.filter((p) => p.role !== 'QB');
  const ordered = [
    ...reads.windows.map((w) => w.id).filter((id) => receivers.some((p) => p.id === id)),
    ...receivers.map((p) => p.id).filter((id) => !reads.windows.some((w) => w.id === id)),
  ].filter((id, i, a) => a.indexOf(id) === i);
  const colorOf = (id: string): string => COLORS[ordered.indexOf(id) % COLORS.length]!;

  const cur = frameAt(frames, t)?.qb;
  const decision = reads.decision;
  const decisionLabel = decisionText(reads, labelOf);
  const x = (at: number): number => (pct(at) / 100) * CHART_W;
  const y = (v: number): number => CHART_H - (Math.min(100, Math.max(0, v)) / 100) * CHART_H;

  const thresholds = [...new Set(ordered.map((id) => minScoreFor(id, offense.readPlan, tuning)))];
  const scoreFrames = frames.filter((f) => f.qb !== undefined);
  const decisionScoreFrame = frameAt(scoreFrames, decision.t);
  const dotScore =
    decision.targetId !== undefined ? decisionScoreFrame?.qb?.scores[decision.targetId] : undefined;

  const playhead = (
    <div
      data-testid="read-playhead"
      className="pointer-events-none absolute inset-y-0 w-px bg-black dark:bg-white"
      style={{ left: `${pct(t)}%` }}
    />
  );

  return (
    <section
      data-testid="read-timeline"
      className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-900 dark:bg-slate-800 dark:text-slate-100"
    >
      <button
        type="button"
        data-testid="read-timeline-toggle"
        aria-expanded={open}
        aria-label={s.toggle}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left font-semibold"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {s.title}
        <span data-testid="read-decision-summary" className="font-normal text-slate-600 dark:text-slate-300">
          {decisionLabel}
        </span>
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0" />
            <div className="relative h-4 flex-1">
              <div
                data-testid="read-decision"
                className="absolute top-0 flex h-full -translate-x-px items-center border-l-2 border-red-600 pl-1 font-medium whitespace-nowrap text-red-700 dark:text-red-300"
                style={
                  pct(decision.t) > 60
                    ? {
                        right: `${100 - pct(decision.t)}%`,
                        borderLeft: 0,
                        borderRight: '2px solid #dc2626',
                        paddingRight: 4,
                      }
                    : { left: `${pct(decision.t)}%` }
                }
              >
                {decisionLabel}
              </div>
            </div>
          </div>
          {ordered.map((id) => {
            const label = labelOf(id);
            const win = reads.windows.find((w) => w.id === id);
            const winIndex = win ? win.index + 1 : undefined;
            const current = cur?.readId === id;
            return (
              <div
                key={id}
                data-testid={`read-tl-row-${label}`}
                data-current={current ? 'true' : undefined}
                className={`flex items-center gap-2 rounded ${current ? 'bg-blue-100 dark:bg-blue-950' : ''}`}
              >
                <span className="flex w-14 shrink-0 items-center gap-1">
                  <span className="font-medium" style={{ color: colorOf(id) }}>
                    {label}
                  </span>
                  {winIndex !== undefined && (
                    <span className="rounded bg-blue-600 px-1 text-[10px] text-white">#{winIndex}</span>
                  )}
                </span>
                <div className="relative h-4 flex-1">
                  {win && (
                    <div
                      data-testid={`read-window-${label}`}
                      data-auto={win.auto ? 'true' : 'false'}
                      title={`${s.window(win.index + 1, win.from, win.to, win.auto)}`}
                      className={`absolute top-0 h-2 rounded-sm ${
                        win.auto
                          ? 'border border-dashed border-blue-600 bg-blue-300/60'
                          : 'bg-blue-600 dark:bg-blue-400'
                      }`}
                      style={{
                        left: `${pct(win.from)}%`,
                        width: `${Math.max(0, pct(win.to) - pct(win.from))}%`,
                      }}
                    >
                      <span className="pointer-events-none px-0.5 text-[9px] leading-2 text-slate-900">
                        #{win.index + 1} {s.duration(win.to - win.from)}
                      </span>
                    </div>
                  )}
                  {(result.metrics.openWindows[id] ?? []).map(([a, b], k) => (
                    <div
                      key={k}
                      data-testid={`open-window-${label}`}
                      title={s.open(a, b)}
                      className="absolute bottom-0 h-1.5 rounded-sm bg-green-500"
                      style={{ left: `${pct(a)}%`, width: `${Math.max(0, pct(b) - pct(a))}%` }}
                    />
                  ))}
                  {playhead}
                </div>
              </div>
            );
          })}

          <div className="flex items-stretch gap-2">
            <div className="w-14 shrink-0 text-[10px] text-slate-600 dark:text-slate-300">{s.scores}</div>
            <div className="relative flex-1">
              <svg
                data-testid="read-scores"
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                className="block w-full rounded bg-white dark:bg-slate-900"
                style={{ height: CHART_H }}
                role="img"
                aria-label={s.scores}
              >
                {thresholds.map((v) => (
                  <g key={v} data-testid={`read-threshold-${v}`}>
                    <line
                      x1={0}
                      x2={CHART_W}
                      y1={y(v)}
                      y2={y(v)}
                      stroke="#64748b"
                      strokeWidth={1}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
                {ordered.map((id) => (
                  <polyline
                    key={id}
                    data-testid={`read-score-line-${labelOf(id)}`}
                    fill="none"
                    stroke={colorOf(id)}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    points={scoreFrames
                      .map((f) => `${x(f.t).toFixed(1)},${y(f.qb!.scores[id] ?? 0).toFixed(1)}`)
                      .join(' ')}
                  />
                ))}
                <line
                  x1={x(t)}
                  x2={x(t)}
                  y1={0}
                  y2={CHART_H}
                  stroke="currentColor"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  data-testid="read-decision-line"
                  x1={x(decision.t)}
                  x2={x(decision.t)}
                  y1={0}
                  y2={CHART_H}
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {dotScore !== undefined && (
                <span
                  data-testid="read-decision-dot"
                  className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600"
                  style={{ left: `${pct(decision.t)}%`, top: y(dotScore) }}
                />
              )}
              {thresholds.map((v) => (
                <span
                  key={v}
                  className="pointer-events-none absolute right-1 text-[10px] text-slate-600 dark:text-slate-300"
                  style={{ top: Math.max(0, y(v) - 12) }}
                >
                  {s.threshold(v)}
                </span>
              ))}
            </div>
            <ul className="flex w-24 shrink-0 flex-col justify-center gap-0.5">
              {ordered.map((id) => {
                const label = labelOf(id);
                const v = cur?.scores[id];
                return (
                  <li key={id} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: colorOf(id) }}
                    />
                    <span>{label}</span>
                    <span data-testid={`read-score-${label}`} className="ml-auto tabular-nums">
                      {v === undefined ? strings.result.none : Math.round(v)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
