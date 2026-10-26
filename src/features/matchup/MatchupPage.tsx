/**
 * Matchup screen (SRS §12.1): `/matchup/new` (create dialog) and `/matchup/:id` (simulate, tweak,
 * play back, save). FR-MU-01..04, FR-MU-08, FR-DAT-03, FR-DAT-04.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExportPngButton } from '@/components/ExportPngButton';
import { Select } from '@/components/ui';
import { Timeline, type TimelineMarker } from '@/components/field/Timeline';
import { usePlayback } from '@/components/field/usePlayback';
import { useDbSnapshot, useMatchupBundle } from '@/db/hooks';
import { AddToInstallButton } from '@/features/install/AddToInstallButton';
import { matchupsRepo } from '@/db/repos/matchups';
import type { DbSnapshot, Matchup, Play, SimEventType } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useAutoSave } from '@/lib/useAutoSave';
import { useMatchupStore, type OverlayKey } from '@/store/matchupStore';
import { levelOf } from './buildSimInput';
import { ControlsPanel } from './ControlsPanel';
import { MatchupField } from './MatchupField';
import { NewMatchupDialog } from './NewMatchupDialog';
import { PlayerPanel } from './PlayerPanel';
import { ReadTimeline } from './ReadTimeline';
import { RandomDefense } from './RandomDefense';
import { ResultPanel } from './ResultPanel';
import { RunManyPanel } from './RunManyPanel';
import { useMatchupShortcuts } from './useMatchupShortcuts';
import { useMatchupSim } from './useMatchupSim';

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
const OVERLAY_KEYS: OverlayKey[] = [
  'plannedRoutes',
  'trails',
  'zones',
  'manLines',
  'ballPath',
  'separation',
  'qbEyes',
  'perception',
];
const frame = 'h-[calc(100vh-3.5rem)] min-h-[480px]';

function NewMatchupEntry(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <NewMatchupDialog
      open
      initialOffenseId={params.get('offense') ?? ''}
      initialDefenseId={params.get('defense') ?? ''}
      onClose={() => navigate('/')}
    />
  );
}

function Notice({ testId, children }: { testId: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col items-start gap-3 p-6" data-testid={testId}>
      {children}
      <Link to="/" className="text-blue-700 underline dark:text-blue-300">
        {t.matchup.back}
      </Link>
    </div>
  );
}

function MatchupEditor({
  initial,
  offense,
  defense,
  snapshot,
}: {
  initial: Matchup;
  offense: Play;
  defense: Play;
  snapshot: DbSnapshot;
}): JSX.Element {
  // Working copy: initialised once per id (the editor is keyed by id); our own saves do not reset it.
  const [working, setWorking] = useState<Matchup>(initial);
  const [hidden, setHidden] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const autosave = useAutoSave(working, (m) => matchupsRepo.put({ ...m, updatedAt: Date.now() }));
  // Random pick (FR-RD-01): flush right after the commit (effects run after useAutoSave's own) so the
  // persisted defensePlayId is never stale.
  const [pickedAt, setPickedAt] = useState(0);
  const flush = autosave.flush;
  useEffect(() => {
    if (pickedAt > 0) void flush();
  }, [pickedAt, flush]);

  const overlays = useMatchupStore((s) => s.overlays);
  const toggleOverlay = useMatchupStore((s) => s.toggleOverlay);
  const debugDefenderId = useMatchupStore((s) => s.debugDefenderId);
  const setDebugDefender = useMatchupStore((s) => s.setDebugDefender);
  const { built, result, error } = useMatchupSim(working, offense, defense, snapshot, overlays.perception);
  const labels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of built?.offense.players ?? []) out[p.id] = p.label;
    return out;
  }, [built]);
  const duration = result && result.frames.length > 0 ? result.frames[result.frames.length - 1]!.t : 0;
  const minT = result && result.frames.length > 0 ? result.frames[0]!.t : 0;
  const playback = usePlayback({ duration, minT });
  const ended = duration > 0 && !playback.playing && playback.t >= duration;

  const markers = useMemo<TimelineMarker[]>(
    () =>
      (result?.events ?? []).filter((e) => MARKER_TYPES.has(e.type)).map((e) => ({ t: e.t, type: e.type })),
    [result],
  );
  const markTimes = useMemo(() => markers.map((m) => m.t), [markers]);
  useMatchupShortcuts(playback, markTimes);

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

  const field = snapshot.settings.fields[offense.format];

  return (
    <div
      data-testid="matchup-page"
      className={`grid ${frame} grid-cols-[minmax(0,1fr)_22rem] grid-rows-[auto_minmax(0,1fr)_auto]`}
    >
      <div className="col-span-2 flex flex-wrap items-end gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <Link to="/" className="text-blue-700 underline dark:text-blue-300">
          {t.matchup.back}
        </Link>
        <div className="min-w-[12rem] flex-1">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.matchup.name}
            <input
              data-testid="matchup-name"
              value={working.name ?? ''}
              onChange={(e) => setWorking((m) => ({ ...m, name: e.target.value }))}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
        <span data-testid="matchup-save-status" className="text-sm text-slate-600 dark:text-slate-300">
          {t.common.saveStatus[autosave.status]}
        </span>
        <AddToInstallButton matchupId={working.id} />
      </div>

      <div className="relative min-w-0 overflow-hidden">
        {error !== null ? (
          <p role="alert" data-testid="matchup-sim-error" className="p-4 text-red-700 dark:text-red-300">
            {t.matchup.simError}: {error}
          </p>
        ) : built && result ? (
          <div ref={fieldRef} className="h-full w-full">
            <MatchupField
              built={built}
              result={result}
              t={playback.t}
              field={field}
              ballSpot={working.ballSpot}
              levels={levels}
              hideDefenseOverlays={hidden}
            />
          </div>
        ) : null}
        <div className="absolute right-2 top-2 flex items-start gap-2">
          <ExportPngButton getNode={() => fieldRef.current} fileName={`${working.name || 'matchup'}.png`} />
          <details className="rounded border bg-white p-2 text-sm shadow dark:bg-slate-800">
            <summary data-testid="overlay-menu" className="cursor-pointer">
              {t.matchup.overlayMenu}
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {OVERLAY_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-testid={`overlay-toggle-${k}`}
                    checked={overlays[k]}
                    onChange={() => toggleOverlay(k)}
                  />
                  {t.matchupField.overlays[k]}
                </label>
              ))}
              {overlays.perception && built && (
                <Select
                  label={t.matchupField.debugDefender}
                  data-testid="debug-defender"
                  value={debugDefenderId ?? ''}
                  onChange={(e) => setDebugDefender(e.target.value === '' ? null : e.target.value)}
                >
                  <option value="">{t.matchupField.debugDefenderNone}</option>
                  {built.defense.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </details>
        </div>
      </div>

      <aside className="row-span-2 flex flex-col gap-3 overflow-y-auto border-l border-slate-200 p-3 dark:border-slate-700">
        <RandomDefense
          offense={offense}
          defense={defense}
          hidden={hidden}
          ended={ended}
          onPick={(id) => {
            setWorking((m) => ({ ...m, defensePlayId: id }));
            // Flush on the next commit so the bundle reloads with the new defense before the reveal.
            setPickedAt((n) => n + 1);
          }}
          onHiddenChange={setHidden}
        />
        <ControlsPanel matchup={working} format={offense.format} onChange={setWorking} />
        {built && <PlayerPanel matchup={working} built={built} snapshot={snapshot} onChange={setWorking} />}
        <div className="flex gap-3 text-sm">
          <Link
            data-testid="edit-offense"
            to={`/play/${offense.id}`}
            className="text-blue-700 underline dark:text-blue-300"
          >
            {t.matchup.edit.offense}
          </Link>
          {hidden ? (
            <span data-testid="defense-name-hidden">{t.randomDef.hiddenName}</span>
          ) : (
            <Link
              data-testid="edit-defense"
              to={`/play/${defense.id}`}
              className="text-blue-700 underline dark:text-blue-300"
            >
              {t.matchup.edit.defense}
            </Link>
          )}
        </div>
        {built && <RunManyPanel input={built.input} labels={labels} />}
        {built && result && (
          <ResultPanel result={result} offense={built.offense} t={playback.t} tuning={built.input.tuning} />
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t.matchup.notes}
          <textarea
            data-testid="matchup-notes"
            rows={4}
            value={working.notes ?? ''}
            onChange={(e) => setWorking((m) => ({ ...m, notes: e.target.value }))}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </aside>

      <div className="flex flex-col gap-1 px-3 py-2">
        <Timeline playback={playback} duration={duration} minT={minT} markers={markers} />
        {built && result && (
          <ReadTimeline result={result} offense={built.offense} t={playback.t} tuning={built.input.tuning} />
        )}
      </div>
    </div>
  );
}

function MatchupLoader({ id }: { id: string }): JSX.Element {
  const bundle = useMatchupBundle(id);
  const snapshot = useDbSnapshot();
  if (bundle === undefined || snapshot === undefined) return <div className="p-6">{t.matchup.loading}</div>;
  if (bundle.status === 'missing-matchup') {
    return (
      <Notice testId="matchup-not-found">
        <p>{t.matchup.notFound}</p>
      </Notice>
    );
  }
  if (bundle.status === 'missing-play') {
    const both = bundle.missing.length > 1;
    const msg = both ? t.matchup.missingPlay.both : t.matchup.missingPlay[bundle.missing[0] ?? 'offense'];
    return (
      <Notice testId="matchup-missing-play">
        <p>{msg}</p>
      </Notice>
    );
  }
  return (
    <MatchupEditor
      key={id}
      initial={bundle.matchup}
      offense={bundle.offense}
      defense={bundle.defense}
      snapshot={snapshot}
    />
  );
}

export default function MatchupPage(): JSX.Element {
  const { id } = useParams();
  if (id === undefined) return <NewMatchupEntry />;
  return <MatchupLoader key={id} id={id} />;
}
