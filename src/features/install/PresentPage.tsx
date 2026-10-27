/**
 * Present mode (SRS §12.1, FR-IN-04, FR-IN-05): fullscreen, one Install item at a time, autoplaying
 * animation with coach notes. ← / → items, Space play/pause, N notes, L loop, Esc exit.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Timeline, type TimelineMarker } from '@/components/field/Timeline';
import { usePlayback } from '@/components/field/usePlayback';
import { useDbSnapshot, useInstall, useMatchupBundle } from '@/db/hooks';
import type { DbSnapshot, Install, InstallItem, Matchup, Play, SimEventType } from '@/domain/types';
import { levelOf } from '@/features/matchup/buildSimInput';
import { MatchupField } from '@/features/matchup/MatchupField';
import { OpenWindows } from '@/features/matchup/OpenWindows';
import { useMatchupSim } from '@/features/matchup/useMatchupSim';
import { t } from '@/i18n/vi';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { sortedItems } from './items';
import { NoteText } from './NoteText';

const MARKER_TYPES: ReadonlySet<SimEventType> = new Set(['snap', 'break', 'throw', 'catch', 'sack', 'int']);

const btn =
  'min-h-10 shrink-0 rounded-md border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-40';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function PlayView({
  matchup,
  offense,
  defense,
  snapshot,
  item,
  loop,
  showNotes,
  contrast,
}: {
  matchup: Matchup;
  offense: Play;
  defense: Play;
  snapshot: DbSnapshot;
  item: InstallItem;
  loop: boolean;
  showNotes: boolean;
  contrast: boolean;
}): JSX.Element {
  const isDesktop = useIsDesktop();
  const { built, result, error } = useMatchupSim(matchup, offense, defense, snapshot);
  const duration = result && result.frames.length > 0 ? result.frames[result.frames.length - 1]!.t : 0;
  const playback = usePlayback({ duration, autoPlay: true, loop });
  const { setLoop, toggle } = playback;
  useEffect(() => setLoop(loop), [loop, setLoop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === ' ') {
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const markers = useMemo<TimelineMarker[]>(
    () =>
      (result?.events ?? []).filter((e) => MARKER_TYPES.has(e.type)).map((e) => ({ t: e.t, type: e.type })),
    [result],
  );
  const levels = useMemo(() => {
    const out: Record<string, ReturnType<typeof levelOf>> = {};
    if (!built) return out;
    for (const p of built.offense.players) {
      const st = built.input.offenseStats[p.id];
      if (st) out[p.id] = levelOf(st, snapshot);
    }
    for (const p of built.defense.players) {
      const st = built.input.defenseStats[p.id];
      if (st) out[p.id] = levelOf(st, snapshot);
    }
    return out;
  }, [built, snapshot]);

  const title = matchup.name?.trim() || `${offense.name} ${t.present.versus} ${defense.name}`;
  return (
    <>
      <h1 data-testid="present-title" className="px-4 py-1 text-lg font-semibold">
        {title}
      </h1>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="min-h-[50vh] flex-1">
            {error !== null ? (
              <p role="alert" data-testid="present-sim-error" className="p-4 text-red-300">
                {t.present.simError}: {error}
              </p>
            ) : built && result ? (
              <MatchupField
                built={built}
                result={result}
                t={playback.t}
                field={snapshot.settings.fields[offense.format]}
                ballSpot={matchup.ballSpot}
                levels={levels}
                theme={contrast ? 'contrast' : 'normal'}
              />
            ) : null}
          </div>
          {built && result && (
            <div className="shrink-0 px-3 py-2">
              <OpenWindows
                result={result}
                offense={offense}
                t={playback.t}
                tuning={snapshot.settings.tuning}
                size="large"
              />
            </div>
          )}
        </div>
        {showNotes && (
          <aside
            data-testid="present-notes"
            aria-label={t.present.notesSheet}
            className={
              isDesktop
                ? 'w-72 shrink-0 overflow-y-auto border-l border-slate-600 p-4 text-lg'
                : 'absolute inset-x-0 bottom-0 z-30 max-h-[45%] overflow-y-auto rounded-t-xl border-t border-slate-500 bg-slate-800/95 p-4 text-base shadow-2xl'
            }
          >
            {item.coachNote?.trim() ? (
              <NoteText text={item.coachNote} />
            ) : (
              <p className="text-slate-400">{t.present.noNotes}</p>
            )}
          </aside>
        )}
      </div>
      <div className="bg-white px-3 py-1 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <Timeline playback={playback} duration={duration} markers={markers} compact />
      </div>
    </>
  );
}

function ItemView({
  item,
  snapshot,
  loop,
  showNotes,
  contrast,
}: {
  item: InstallItem;
  snapshot: DbSnapshot | undefined;
  loop: boolean;
  showNotes: boolean;
  contrast: boolean;
}): JSX.Element {
  const bundle = useMatchupBundle(item.matchupId);
  if (bundle === undefined || snapshot === undefined) return <p className="p-6">{t.present.loading}</p>;
  if (bundle.status !== 'ok') {
    return (
      <p role="alert" data-testid="present-item-error" className="p-6 text-red-300">
        {t.present.itemError}
      </p>
    );
  }
  return (
    <PlayView
      key={item.id}
      matchup={bundle.matchup}
      offense={bundle.offense}
      defense={bundle.defense}
      snapshot={snapshot}
      item={item}
      loop={loop}
      showNotes={showNotes}
      contrast={contrast}
    />
  );
}

function Presenter({ install }: { install: Install }): JSX.Element {
  const navigate = useNavigate();
  const snapshot = useDbSnapshot();
  const items = useMemo(() => sortedItems(install), [install]);
  const [index, setIndex] = useState(0);
  const isDesktop = useIsDesktop();
  const [showNotes, setShowNotes] = useState(isDesktop);
  const [loop, setLoop] = useState(false);
  const [contrast, setContrast] = useState(false);

  const last = Math.max(0, items.length - 1);
  const cur = Math.min(index, last);
  const go = (d: number): void => setIndex(Math.min(last, Math.max(0, cur + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setIndex((i) => Math.min(last, Math.min(i, last) + 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setIndex((i) => Math.max(0, Math.min(i, last) - 1));
          break;
        case 'n':
        case 'N':
          setShowNotes((v) => !v);
          break;
        case 'l':
        case 'L':
          setLoop((v) => !v);
          break;
        case 'Escape':
          navigate(`/install/${install.id}`);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, navigate, install.id]);

  const item = items[cur];
  const big = `${btn} min-h-12 flex-1 text-base`;
  const nav = (
    <>
      <button
        type="button"
        data-testid="present-prev"
        className={isDesktop ? btn : big}
        disabled={cur <= 0}
        onClick={() => go(-1)}
      >
        {t.present.prev}
      </button>
      <span data-testid="present-index" className="min-w-[4rem] text-center">
        {t.present.position(items.length === 0 ? 0 : cur + 1, items.length)}
      </span>
      <button
        type="button"
        data-testid="present-next"
        className={isDesktop ? btn : big}
        disabled={cur >= last}
        onClick={() => go(1)}
      >
        {t.present.next}
      </button>
    </>
  );
  return (
    <div data-testid="present-page" className="fixed inset-0 flex flex-col bg-slate-900 text-white">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-700 px-3 py-2 lg:flex-wrap lg:overflow-visible">
        <button
          type="button"
          data-testid="present-exit"
          className={btn}
          onClick={() => navigate(`/install/${install.id}`)}
        >
          {t.present.exit}
        </button>
        {isDesktop && nav}
        <span className="flex-1" />
        <button
          type="button"
          data-testid="present-notes-toggle"
          aria-pressed={showNotes}
          className={btn}
          onClick={() => setShowNotes((v) => !v)}
        >
          {t.present.notes}
        </button>
        <button
          type="button"
          data-testid="present-loop"
          aria-pressed={loop}
          className={btn}
          onClick={() => setLoop((v) => !v)}
        >
          {t.present.loop}
        </button>
        <button
          type="button"
          data-testid="present-contrast"
          aria-pressed={contrast}
          className={btn}
          onClick={() => setContrast((v) => !v)}
        >
          {t.present.contrast}
        </button>
        <button
          type="button"
          data-testid="present-fullscreen"
          className={btn}
          onClick={() => void document.documentElement.requestFullscreen?.()}
        >
          {t.present.fullscreen}
        </button>
      </div>
      {item === undefined ? (
        <p data-testid="present-empty" className="p-6">
          {t.present.empty}
        </p>
      ) : (
        <ItemView
          key={item.id}
          item={item}
          snapshot={snapshot}
          loop={loop}
          showNotes={showNotes}
          contrast={contrast}
        />
      )}
      {!isDesktop && (
        <div
          data-testid="present-bottom-bar"
          className="flex items-center gap-2 border-t border-slate-700 px-3 py-2"
        >
          {nav}
        </div>
      )}
    </div>
  );
}

export default function PresentPage(): JSX.Element {
  const { id } = useParams();
  const install = useInstall(id);
  if (install === undefined) return <p className="p-6">{t.present.loading}</p>;
  if (install === null) {
    return (
      <div className="flex flex-col items-start gap-3 p-6" data-testid="present-not-found">
        <p>{t.present.notFound}</p>
        <Link to="/install" className="text-blue-700 underline dark:text-blue-300">
          {t.present.exit}
        </Link>
      </div>
    );
  }
  return <Presenter install={install} />;
}
