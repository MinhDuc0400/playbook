/**
 * Freestyle trial (FR-FS-05..07, D-27): the Simple Matchup pipeline on a transient, never persisted
 * Matchup. Mounted fresh on every "Chạy thử", so each run re-simulates the current plays from t = 0.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timeline, type TimelineMarker } from '@/components/field/Timeline';
import { usePlayback } from '@/components/field/usePlayback';
import type { DbSnapshot, Play, Settings, SimEventType } from '@/domain/types';
import { bestThrowTime } from '@/features/matchup/bestThrow';
import { createMatchup, type levelOf } from '@/features/matchup/buildSimInput';
import { MatchupField } from '@/features/matchup/MatchupField';
import { OpenWindows } from '@/features/matchup/OpenWindows';
import { QbModePanel } from '@/features/matchup/QbModePanel';
import { ResultSummary } from '@/features/matchup/ResultPanel';
import { useMatchupShortcuts } from '@/features/matchup/useMatchupShortcuts';
import { useMatchupSim } from '@/features/matchup/useMatchupSim';
import { buildQbKeyMap, qbFeedback, useQbKeys, useQbModeState } from '@/features/matchup/useQbMode';
import { t } from '@/i18n/vi';
import { useIsDesktop } from '@/lib/useMediaQuery';

const MARKER_TYPES: ReadonlySet<SimEventType> = new Set([
  'snap',
  'break',
  'ruleFired',
  'throw',
  'catch',
  'sack',
  'int',
  'deflect',
  'incomplete',
]);
const NO_LEVELS: Record<string, ReturnType<typeof levelOf>> = {};

/** Transient matchup of a freestyle trial: seed 1, no flips, never saved. */
export function trialMatchup(offense: Play, defense: Play) {
  return {
    ...createMatchup({
      offensePlayId: offense.id,
      defensePlayId: defense.id,
      now: 0,
      idGen: () => 'freestyle',
    }),
    defenseFlip: 'none' as const,
    offenseFlipped: false,
  };
}

/** Freestyle always runs the forced Simple input, with no stored lineups or athletes. */
export function trialSnapshot(settings: Settings): DbSnapshot {
  return { settings, lineups: {}, athletes: {} };
}

export function TrialView({
  offense,
  defense,
  settings,
}: {
  offense: Play;
  defense: Play;
  settings: Settings;
}): JSX.Element {
  const isDesktop = useIsDesktop();
  const matchup = useMemo(() => trialMatchup(offense, defense), [offense, defense]);
  const snapshot = useMemo(() => trialSnapshot(settings), [settings]);
  const qb = useQbModeState();
  const { built, result, error } = useMatchupSim(
    matchup,
    offense,
    defense,
    snapshot,
    false,
    qb.override,
    true,
  );
  const duration = result && result.frames.length > 0 ? result.frames[result.frames.length - 1]!.t : 0;
  const minT = result && result.frames.length > 0 ? result.frames[0]!.t : 0;
  const playback = usePlayback({ duration, minT });

  const keyMap = useMemo(() => buildQbKeyMap(result, built?.offense.players ?? []), [result, built]);
  const qbThrown = qb.manualThrow !== null;
  const { throwTo, record } = qb;
  const playbackT = playback.t;
  const pickReceiver = useCallback((id: string) => throwTo(id, playbackT), [throwTo, playbackT]);
  useQbKeys(qb.enabled && !qbThrown, keyMap, pickReceiver);
  useEffect(() => record(result, keyMap), [record, result, keyMap]);
  const { seek, play } = playback;
  const minTRef = useRef(minT);
  useEffect(() => {
    minTRef.current = minT;
  });
  const restart = useCallback(() => {
    seek(minTRef.current);
    play();
  }, [seek, play]);
  const feedback = useMemo(
    () => (result && qb.manualThrow ? qbFeedback(result, keyMap, qb.manualThrow) : null),
    [result, qb.manualThrow, keyMap],
  );
  const [bestTime, setBestTime] = useState<{ t: number; separation: number } | null>(null);
  const [bestNone, setBestNone] = useState(false);
  const builtInput = built?.input;
  const pickBest = useCallback(
    (id: string) => {
      if (!result || !builtInput) return;
      const b = bestThrowTime({ result, input: builtInput, targetId: id });
      if (!b) {
        setBestNone(true);
        return;
      }
      setBestNone(false);
      setBestTime(b);
      throwTo(id, b.t);
      restart();
    },
    [result, builtInput, throwTo, restart],
  );
  const resetBest = (): void => {
    setBestTime(null);
    setBestNone(false);
  };

  const markers = useMemo<TimelineMarker[]>(
    () =>
      (result?.events ?? []).filter((e) => MARKER_TYPES.has(e.type)).map((e) => ({ t: e.t, type: e.type })),
    [result],
  );
  const markTimes = useMemo(() => markers.map((m) => m.t), [markers]);
  useMatchupShortcuts(playback, markTimes);

  const field = settings.fields[offense.format];
  const hideReadInfo = qb.enabled && !qbThrown;

  const fieldBody =
    error !== null ? (
      <p role="alert" data-testid="matchup-sim-error" className="p-4 text-red-700 dark:text-red-300">
        {t.matchup.simError}: {error}
      </p>
    ) : built && result ? (
      <MatchupField
        built={built}
        result={result}
        t={playback.t}
        field={field}
        ballSpot={matchup.ballSpot}
        levels={NO_LEVELS}
        hideReadInfo={hideReadInfo}
        qbKeys={qb.enabled ? keyMap : undefined}
        onQbPick={qb.enabled && !qbThrown ? pickReceiver : undefined}
      />
    ) : null;

  const qbToggle = (
    <label
      title={t.matchup.qb.toggleHelp}
      className="flex min-h-10 shrink-0 items-center gap-1 rounded border bg-white px-2 py-1 text-sm shadow dark:bg-slate-800"
    >
      <input
        type="checkbox"
        data-testid="qb-mode-toggle"
        checked={qb.enabled}
        onChange={(e) => {
          e.currentTarget.blur(); // keep Space / keys for playback and the QB keys
          if (e.target.checked) {
            qb.enable();
            restart();
          } else {
            resetBest();
            qb.disable();
          }
        }}
      />
      {t.matchup.qb.toggle}
    </label>
  );

  const qbPanel = qb.enabled ? (
    <QbModePanel
      keyMap={keyMap}
      feedback={feedback}
      outcome={result && feedback && playback.t >= result.outcome.t ? result.outcome.kind : null}
      tally={qb.tally}
      bestTime={bestTime}
      bestNone={bestNone}
      onPickBest={pickBest}
      onRetry={() => {
        resetBest();
        qb.retry();
        restart();
      }}
      onExit={() => {
        resetBest();
        qb.disable();
      }}
    />
  ) : null;

  return (
    <div
      data-testid="freestyle-trial"
      aria-label={t.freestyle.trialLabel}
      className={`flex min-w-0 flex-col ${isDesktop ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}
    >
      <div
        data-testid="freestyle-field"
        className={`relative min-w-0 overflow-hidden border-b border-slate-200 dark:border-slate-700 ${
          isDesktop ? 'h-[min(60vh,40rem)] min-h-[20rem] shrink-0' : 'h-[max(50dvh,300px)] shrink-0'
        }`}
      >
        {fieldBody}
        <div className="pointer-events-none absolute left-1 right-1 top-1 z-20 flex items-start gap-1 overflow-x-auto [&>*]:pointer-events-auto">
          {qbToggle}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-2 py-2">
        <Timeline playback={playback} duration={duration} minT={minT} markers={markers} />
        {built && result && (
          <OpenWindows result={result} offense={built.offense} t={playback.t} tuning={built.input.tuning} />
        )}
        {built && result && <ResultSummary result={result} offense={built.offense} />}
      </div>
      {qbPanel && <div className="px-2 pb-2">{qbPanel}</div>}
    </div>
  );
}
