/** Feedback panel of the "QB tự ném" mode (D-23): key legend, press-time read, best alternative, tally. */
import type { OutcomeKind } from '@/domain/types';
import { t } from '@/i18n/vi';
import type { QbFeedback, QbKey, QbTally } from './useQbMode';

export interface QbModePanelProps {
  keyMap: readonly QbKey[];
  feedback: QbFeedback | null;
  /** Outcome once the ball has landed (playhead ≥ outcome.t); null while it is in flight. */
  outcome: OutcomeKind | null;
  tally: QbTally;
  onRetry(): void;
  onExit(): void;
}

const s = t.matchup.qb;

export function QbModePanel({
  keyMap,
  feedback,
  outcome,
  tally,
  onRetry,
  onExit,
}: QbModePanelProps): JSX.Element {
  return (
    <section data-testid="qb-mode-panel" className="space-y-2 rounded border p-3 text-sm">
      <h2 className="font-semibold">{s.title}</h2>
      {feedback === null ? (
        <>
          <p data-testid="qb-hint">
            {s.hint} {s.clickHint}
          </p>
          <ul data-testid="qb-key-legend" className="flex flex-wrap gap-2">
            {keyMap.map((k) => (
              <li key={k.key} className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                <kbd className="font-semibold">{k.key}</kbd> = {k.label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <dl className="space-y-1">
          <div>
            {s.target}: <span data-testid="qb-feedback-target">{feedback.label}</span>
          </div>
          <div>
            {s.time}: <span data-testid="qb-feedback-time">{feedback.t.toFixed(2)} s</span>
          </div>
          <div>
            {s.score}:{' '}
            <span data-testid="qb-feedback-score">
              {feedback.score === undefined ? t.result.none : Math.round(feedback.score)}
            </span>
          </div>
          <div>
            {s.separation}:{' '}
            <span data-testid="qb-feedback-sep">
              {feedback.separation === undefined ? t.result.none : feedback.separation.toFixed(1)}
            </span>
          </div>
          <div data-testid="qb-feedback-best">
            {feedback.isBest || feedback.best === undefined
              ? s.bestChosen
              : s.best(feedback.best.label, feedback.best.score)}
          </div>
          <div>
            {s.outcome}:{' '}
            <span data-testid="qb-feedback-outcome">
              {outcome === null ? s.inFlight : t.result.outcome[outcome]}
            </span>
          </div>
        </dl>
      )}
      <p data-testid="qb-tally">
        {tally.attempts === 0 ? s.tallyEmpty : s.tally(tally.attempts, tally.completions, tally.best)}
      </p>
      <div className="flex gap-2">
        <button type="button" data-testid="qb-retry" onClick={onRetry} className="rounded border px-2 py-1">
          {s.retry}
        </button>
        <button type="button" data-testid="qb-exit" onClick={onExit} className="rounded border px-2 py-1">
          {s.exit}
        </button>
      </div>
    </section>
  );
}
