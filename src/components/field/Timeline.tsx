/**
 * Playback bar (FR-MU-03/04): play/pause, prev/next event, a scrubber with event markers and a speed menu
 * (like a video player's gear). Controlled: all state comes from a Playback (usePlayback).
 * With `gutter` set, the scrubber sits in the same grid columns as the OpenWindows tracks, so one time maps to
 * one x position in both (D-33).
 */
import { useEffect, useRef, useState } from 'react';
import type { SimEventType } from '@/domain/types';
import { t as strings } from '@/i18n/vi';
import { IconButton } from '@/components/ui';
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
  /** Line the scrubber up with OpenWindows of the same size (its label and total columns). */
  gutter?: TrackSize;
}

export type TrackSize = 'normal' | 'large';

/** Widths of the label (left) and total (right) columns shared by OpenWindows rows and the scrubber. */
export const TRACK_GUTTER: Record<TrackSize, { left: string; right: string }> = {
  normal: { left: 'w-14', right: 'w-14' },
  large: { left: 'w-16', right: 'w-20' },
};

const MARKER_COLORS: Partial<Record<SimEventType, string>> = {
  snap: 'bg-slate-700 dark:bg-slate-200',
  break: 'bg-amber-500',
  ruleFired: 'bg-purple-500',
  areaClaim: 'bg-teal-500',
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
const GEAR_PATH =
  'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.7c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z';

function SpeedMenu({ playback }: { playback: Playback }): JSX.Element {
  const p = strings.playback;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="btn-speed-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${p.speed}: ${playback.speed}x`}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium tabular-nums hover:bg-slate-200 dark:hover:bg-slate-700 max-lg:h-10 ${focusRing}`}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d={GEAR_PATH} />
        </svg>
        {playback.speed}x
      </button>
      {open && (
        <div
          role="menu"
          aria-label={p.speed}
          data-testid="speed-menu"
          className="absolute bottom-full right-0 z-20 mb-1 min-w-[7rem] rounded-md border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={playback.speed === s}
              data-testid={`btn-speed-${s}`}
              onClick={() => {
                playback.setSpeed(s);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 max-lg:py-2.5 ${focusRing}`}
            >
              <span className="w-3 text-blue-600 dark:text-blue-400">{playback.speed === s ? '✓' : ''}</span>
              {s === 1 ? p.normalSpeed : `${s}x`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Timeline({
  playback,
  duration,
  minT = 0,
  markers = [],
  compact = false,
  gutter,
}: TimelineProps): JSX.Element {
  const span = duration - minT;
  const pct = (at: number): number => (span > 0 ? Math.min(100, Math.max(0, ((at - minT) / span) * 100)) : 0);
  const p = strings.playback;
  const markTimes = markers.map((m) => m.t);
  const g = gutter ? TRACK_GUTTER[gutter] : null;
  const head = pct(playback.t);

  const time = (
    <span data-testid="timeline-time" className="text-sm tabular-nums" aria-live="off">
      {formatTime(playback.t)}
    </span>
  );

  const [tip, setTip] = useState<number | null>(null);

  const scrubber = (
    <div className="relative min-w-0 flex-1">
      <div className="relative h-5">
        {markers.map((m, i) => {
          const at = pct(m.t);
          const shown = tip === i;
          const text = `${p.events[m.type as keyof typeof p.events] ?? m.type}${m.label ? ` · ${m.label}` : ''} · ${formatTime(m.t)}`;
          return (
            <span
              key={`${m.type}-${m.t}-${i}`}
              data-testid="timeline-marker"
              data-type={m.type}
              tabIndex={0}
              role="img"
              aria-label={text}
              style={{ left: `${at}%` }}
              className={`absolute bottom-0 flex h-5 w-4 -translate-x-1/2 cursor-help items-end justify-center ${focusRing}`}
              onPointerEnter={() => setTip(i)}
              onPointerLeave={() => setTip((v) => (v === i ? null : v))}
              onFocus={() => setTip(i)}
              onBlur={() => setTip((v) => (v === i ? null : v))}
              onClick={() => setTip(i)}
            >
              <span className={`h-4 w-1.5 rounded-sm ${MARKER_COLORS[m.type] ?? 'bg-slate-500'}`} />
              {shown && (
                <span
                  role="tooltip"
                  data-testid="marker-tooltip"
                  className={`pointer-events-none absolute bottom-full z-30 mb-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-slate-900 ${
                    at < 15 ? 'left-0' : at > 85 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  {text}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div
          data-testid="timeline-progress"
          className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-blue-600 dark:bg-blue-400"
          style={{ width: `${head}%` }}
        />
        <input
          type="range"
          data-testid="timeline-scrubber"
          aria-label={p.scrubber}
          min={minT}
          max={duration}
          step={1 / 30}
          value={playback.t}
          onChange={(e) => playback.seek(Number(e.target.value))}
          className={`peer absolute inset-0 h-full w-full cursor-grab appearance-none bg-transparent opacity-0 active:cursor-grabbing [&::-moz-range-thumb]:w-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:appearance-none`}
        />
        <div
          data-testid="timeline-playhead"
          aria-hidden="true"
          className="pointer-events-none absolute -top-5 bottom-0 w-px -translate-x-1/2 bg-slate-900 peer-hover:[&>span]:scale-110 peer-active:[&>span]:scale-125 peer-focus-visible:[&>span]:ring-2 peer-focus-visible:[&>span]:ring-blue-600 peer-focus-visible:[&>span]:ring-offset-2 dark:bg-white"
          style={{ left: `${head}%` }}
        >
          <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow-md transition-transform dark:border-slate-900 dark:bg-blue-400" />
        </div>
      </div>
    </div>
  );

  const playButton = (
    <IconButton
      data-testid="btn-play"
      label={playback.playing ? p.pause : p.play}
      variant="primary"
      className="max-lg:h-10 max-lg:w-10"
      onClick={playback.toggle}
    >
      <Icon d={playback.playing ? PAUSE_PATH : PLAY_PATH} />
    </IconButton>
  );

  return (
    <div
      role="group"
      aria-label={p.bar}
      data-testid="timeline"
      className="flex flex-col gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
    >
      {compact ? (
        <div className="flex items-center gap-2">
          <div className={`shrink-0 ${g?.left ?? ''}`}>{playButton}</div>
          {scrubber}
          <div className={`shrink-0 text-right ${g?.right ?? ''}`}>{time}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {playButton}
            <IconButton
              data-testid="btn-prev-event"
              label={p.prevEvent}
              className="max-lg:h-10 max-lg:w-10"
              onClick={() => playback.stepToMark(-1, markTimes)}
            >
              <Icon d={PREV_PATH} />
            </IconButton>
            <IconButton
              data-testid="btn-next-event"
              label={p.nextEvent}
              className="max-lg:h-10 max-lg:w-10"
              onClick={() => playback.stepToMark(1, markTimes)}
            >
              <Icon d={NEXT_PATH} />
            </IconButton>
            <span className="flex-1" />
            <SpeedMenu playback={playback} />
          </div>
          <div className="flex items-end gap-2">
            <div className={`shrink-0 pb-1 ${g?.left ?? ''}`}>{time}</div>
            {scrubber}
            <div className={`shrink-0 ${g?.right ?? ''}`} />
          </div>
        </>
      )}
    </div>
  );
}
