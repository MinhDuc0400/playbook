/**
 * "Khoảng open" panel (D-26): per receiver, when separation >= separationOpen, on the same time scale
 * as the playback bar. Everything is drawn from engine data (NFR-ARC-03).
 */
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Play, SimResult, TuningParams } from '@/domain/types';
import { t as strings } from '@/i18n/vi';

export interface OpenWindowsProps {
  result: SimResult;
  offense: Play;
  /** Playhead (s). */
  t: number;
  tuning?: TuningParams;
  size?: 'normal' | 'large';
}

const s = strings.openWindows;

export function OpenWindows({
  result,
  offense,
  t,
  tuning = DEFAULT_TUNING,
  size = 'normal',
}: OpenWindowsProps): JSX.Element | null {
  const { frames } = result;
  if (frames.length === 0) return null;
  const large = size === 'large';

  const minT = frames[0]!.t;
  const span = frames[frames.length - 1]!.t - minT;
  const pct = (at: number): number => (span > 0 ? Math.min(100, Math.max(0, ((at - minT) / span) * 100)) : 0);

  const receivers = offense.players.filter((p) => p.role !== 'QB');
  const progression = (offense.progression ?? []).filter(
    (id, i, a) => receivers.some((p) => p.id === id) && a.indexOf(id) === i,
  );
  const rest = receivers
    .filter((p) => !progression.includes(p.id))
    .sort((a, b) => a.start.x - b.start.x)
    .map((p) => p.id);
  const ordered = [...progression, ...rest];

  const throwEvent = result.events.find((e) => e.type === 'throw');
  const outcome = result.outcome;
  const targetId = 'targetId' in outcome ? outcome.targetId : undefined;
  const success = outcome.kind === 'complete';

  const rows = ordered.map((id) => {
    const label = offense.players.find((p) => p.id === id)?.label ?? id;
    const wins = result.metrics.openWindows[id] ?? [];
    const total = wins.reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0);
    return { id, label, wins, total, read: progression.indexOf(id) };
  });

  let best: (typeof rows)[number] | undefined;
  for (const r of rows) if (r.total > 0 && (!best || r.total > best.total)) best = r;
  let bestWin: [number, number] | undefined;
  if (best) bestWin = best.wins.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));

  const text = large ? 'text-base' : 'text-xs';
  const trackH = large ? 'h-5' : 'h-3';

  return (
    <section
      data-testid="open-windows"
      title={s.help}
      className={`rounded-md bg-slate-100 px-2 py-1 text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${text}`}
    >
      <div data-testid="open-windows-scroll" className="max-w-full overflow-x-auto">
        <div className={`flex flex-col ${large ? 'gap-2' : 'gap-1'}`}>
          {rows.map((r) => (
            <div key={r.id} data-testid={`ow-row-${r.label}`} className="flex items-center gap-2">
              <span className={`flex shrink-0 items-center gap-1 ${large ? 'w-16' : 'w-14'}`}>
                <span className="font-medium">{r.label}</span>
                {r.read >= 0 && (
                  <span
                    data-testid={`ow-read-${r.label}`}
                    className="rounded bg-blue-600 px-1 text-[10px] text-white"
                  >
                    {s.readBadge(r.read + 1)}
                  </span>
                )}
              </span>
              <div
                data-testid={`ow-track-${r.label}`}
                className={`relative min-w-[320px] flex-1 rounded-sm bg-slate-300 dark:bg-slate-700 ${trackH}`}
              >
                {r.wins.map(([a, b], k) => (
                  <div
                    key={k}
                    data-testid={`ow-open-${r.label}`}
                    title={s.segment(a, b)}
                    className="absolute inset-y-0 rounded-sm bg-green-500"
                    style={{ left: `${pct(a)}%`, width: `${Math.max(0, pct(b) - pct(a))}%` }}
                  />
                ))}
                {throwEvent && (
                  <div
                    data-testid="ow-throw"
                    title={s.throwMarker(throwEvent.t)}
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-500"
                    style={{ left: `${pct(throwEvent.t)}%` }}
                  />
                )}
                <div
                  data-testid="ow-playhead"
                  className="pointer-events-none absolute -inset-y-0.5 w-px bg-black dark:bg-white"
                  style={{ left: `${pct(t)}%` }}
                />
                {targetId === r.id && (
                  <span
                    data-testid="ow-outcome"
                    data-success={success ? 'true' : 'false'}
                    title={success ? s.complete : s.incomplete}
                    className={`pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 leading-none font-bold ${
                      success ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {success ? '✔' : '✖'}
                  </span>
                )}
              </div>
              <span
                data-testid={`ow-total-${r.label}`}
                className={`shrink-0 text-right tabular-nums ${large ? 'w-20' : 'w-14'}`}
              >
                {s.total(r.total)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p data-testid="ow-summary" className={`mt-1 font-medium ${large ? 'text-lg' : ''}`}>
        {best && bestWin
          ? s.summary(best.label, bestWin[0], bestWin[1], bestWin[1] - bestWin[0])
          : s.nobody(tuning.separationOpen)}
      </p>
    </section>
  );
}
