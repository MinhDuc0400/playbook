/**
 * Playback bar (FR-MU-03/04): play/pause, scrubber with event markers, speed buttons, prev/next event.
 * Controlled: all state comes from a Playback (usePlayback).
 */
import type { SimEventType } from '@/domain/types';
import { t as strings } from '@/i18n/vi';
import { Button, IconButton } from '@/components/ui';
import { PLAYBACK_SPEEDS, type Playback } from './usePlayback';

export interface TimelineMarker {
  t: number;
  type: SimEventType;
  label?: string;
}

export interface TimelineProps {
  playback: Playback;
  duration: number;
  minT?: number;
  markers?: readonly TimelineMarker[];
  /** Hide speed / event buttons (compact preview). */
  compact?: boolean;
}

const MARKER_COLORS: Partial<Record<SimEventType, string>> = {
  snap: 'bg-slate-700 dark:bg-slate-200',
  break: 'bg-amber-500',
  ruleFired: 'bg-purple-500',
  throw: 'bg-blue-600 dark:bg-blue-400',
  catch: 'bg-green-600 dark:bg-green-400',
  sack: 'bg-red-600 dark:bg-red-400',
};

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

function formatTime(sec: number): string {
  const v = Math.round(sec * 10) / 10;
  return `${(v === 0 ? 0 : v).toFixed(1)}${strings.playback.seconds}`;
}

function Icon({ d }: { d: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

const PLAY_PATH = 'M8 5v14l11-7z';
const PAUSE_PATH = 'M6 5h4v14H6zM14 5h4v14h-4z';
const PREV_PATH = 'M6 6h2v12H6zM9.5 12 18 18V6z';
const NEXT_PATH = 'M16 6h2v12h-2zM6 18l8.5-6L6 6z';

export function Timeline({
  playback,
  duration,
  minT = 0,
  markers = [],
  compact = false,
}: TimelineProps): JSX.Element {
  const span = duration - minT;
  const pct = (at: number): number => (span > 0 ? Math.min(100, Math.max(0, ((at - minT) / span) * 100)) : 0);
  const p = strings.playback;
  const markTimes = markers.map((m) => m.t);

  return (
    <div
      role="group"
      aria-label={p.bar}
      data-testid="timeline"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-slate-100 px-2 py-1 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
    >
      <IconButton
        data-testid="btn-play"
        label={playback.playing ? p.pause : p.play}
        variant="primary"
        onClick={playback.toggle}
      >
        <Icon d={playback.playing ? PAUSE_PATH : PLAY_PATH} />
      </IconButton>

      {!compact && (
        <IconButton
          data-testid="btn-prev-event"
          label={p.prevEvent}
          onClick={() => playback.stepToMark(-1, markTimes)}
        >
          <Icon d={PREV_PATH} />
        </IconButton>
      )}

      <div className="relative min-w-[8rem] flex-1">
        <div className="relative h-3">
          {markers.map((m, i) => (
            <span
              key={`${m.type}-${m.t}-${i}`}
              data-testid="timeline-marker"
              data-type={m.type}
              title={m.label ?? m.type}
              style={{ left: `${pct(m.t)}%` }}
              className={`absolute bottom-0 h-3 w-1 -translate-x-1/2 rounded-sm ${MARKER_COLORS[m.type] ?? 'bg-slate-500'}`}
            />
          ))}
        </div>
        <input
          type="range"
          data-testid="timeline-scrubber"
          aria-label={p.scrubber}
          min={minT}
          max={duration}
          step={1 / 30}
          value={playback.t}
          onChange={(e) => playback.seek(Number(e.target.value))}
          className={`block h-8 w-full cursor-pointer accent-blue-600 dark:accent-blue-400 ${focusRing}`}
        />
      </div>

      {!compact && (
        <IconButton
          data-testid="btn-next-event"
          label={p.nextEvent}
          onClick={() => playback.stepToMark(1, markTimes)}
        >
          <Icon d={NEXT_PATH} />
        </IconButton>
      )}

      <span
        data-testid="timeline-time"
        className="min-w-[4.5rem] text-right text-sm tabular-nums"
        aria-live="off"
      >
        {formatTime(playback.t)}
      </span>

      {!compact && (
        <div role="group" aria-label={p.speed} className="flex gap-1">
          {PLAYBACK_SPEEDS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={playback.speed === s ? 'primary' : 'secondary'}
              data-testid={`btn-speed-${s}`}
              aria-pressed={playback.speed === s}
              aria-label={`${p.speed} ${s}x`}
              onClick={() => playback.setSpeed(s)}
            >
              {s}x
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
