/** Suggest page (SRS §12.1, FR-SG-01..04, FR-SG-06): tag tier instantly, sim tier in the Worker. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayThumbnail } from '@/components/field/PlayThumbnail';
import { Button, Select } from '@/components/ui';
import { useDbSnapshot, useLineups, usePlays } from '@/db/hooks';
import type { AggregateResult, ID, Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { createMatchup, buildSimInput } from '@/features/matchup/buildSimInput';
import { suggestKey } from '@/suggest/cache';
import { rankByTag, rankWithSim, type Reason, type SuggestDirection } from '@/suggest/scoring';
import { runMany, type RunManyHandle } from '@/workers/simClient';
import { suggestSessionCache as cache } from './sessionCache';

const s = t.suggest;

function reasonText(r: Reason, offense: Record<string, string>): string {
  switch (r.kind) {
    case 'tag':
      return s.tagReason(r.tag);
    case 'sim':
      return s.simReason(r.pComplete, r.avgYards, r.pSack, r.pInt);
    case 'target': {
      const known = r.routeName !== null ? offense[r.routeName] : undefined;
      const name = known ? `${known} (${r.label})` : r.label;
      return s.targetReason(name, r.avgSepAtThrow, r.completion);
    }
  }
}

interface SimState {
  sig: string;
  aggregates: Record<ID, AggregateResult>;
}

export default function SuggestPage(): JSX.Element {
  const navigate = useNavigate();
  const plays = usePlays();
  const lineups = useLineups();
  const snapshot = useDbSnapshot();
  const [direction, setDirection] = useState<SuggestDirection>('offense-vs-coverage');
  const [playId, setPlayId] = useState('');
  const [lineupId, setLineupId] = useState('');
  const [sim, setSim] = useState<SimState | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const handle = useRef<RunManyHandle | null>(null);
  const runToken = useRef(0);

  useEffect(
    () => () => {
      runToken.current++;
      const h = handle.current;
      handle.current = null;
      h?.cancel();
      h?.promise.catch(() => undefined);
    },
    [],
  );

  const givenSide = direction === 'offense-vs-coverage' ? 'defense' : 'offense';
  const pickable = useMemo(() => (plays ?? []).filter((p) => p.side === givenSide), [plays, givenSide]);
  const given: Play | undefined = pickable.find((p) => p.id === playId);
  const tuning = snapshot?.settings.tuning;
  const runs = tuning?.suggestRuns ?? 30;
  const lineupOptions = (lineups ?? []).filter(
    (l) => given && l.side === given.side && l.format === given.format,
  );
  const activeLineup = lineupOptions.find((l) => l.id === lineupId)?.id;

  const sig = JSON.stringify([direction, given?.id, activeLineup, runs]);
  const tagResults = useMemo(
    () => (given && tuning && plays ? rankByTag(given, plays, tuning) : []),
    [given, tuning, plays],
  );
  const simResults = useMemo(
    () =>
      given && tuning && plays && sim && sim.sig === sig
        ? rankWithSim({ direction, given, candidates: plays, aggregates: sim.aggregates, tuning })
        : null,
    [given, tuning, plays, sim, sig, direction],
  );
  const shown = simResults ?? tagResults;
  const running = progress !== null;

  const cancel = (): void => {
    handle.current?.cancel();
  };

  const runSim = async (): Promise<void> => {
    if (!given || !tuning || !plays || !snapshot) return;
    const candidates = rankByTag(given, plays, tuning, plays.length).map((x) => x.play);
    const token = ++runToken.current;
    const aggregates: Record<ID, AggregateResult> = {};
    setMessage(null);
    setProgress({ done: 0, total: candidates.length });
    try {
      for (const [i, cand] of candidates.entries()) {
        const offense = given.side === 'offense' ? given : cand;
        const defense = given.side === 'offense' ? cand : given;
        const key = suggestKey(
          offense,
          defense,
          [
            given.side === 'offense' ? activeLineup : undefined,
            given.side === 'defense' ? activeLineup : undefined,
          ],
          tuning,
        );
        let agg = cache.get(key);
        if (!agg) {
          const m = createMatchup({
            offensePlayId: offense.id,
            defensePlayId: defense.id,
            now: 0,
            idGen: () => 'suggest',
          });
          m.noise = true;
          if (activeLineup) {
            if (given.side === 'offense') m.offenseLineupId = activeLineup;
            else m.defenseLineupId = activeLineup;
          }
          const { input } = buildSimInput(m, offense, defense, snapshot);
          const h = runMany(input, runs);
          handle.current = h;
          agg = await h.promise;
          handle.current = null;
          if (runToken.current !== token) return;
          cache.set(key, agg);
        }
        aggregates[cand.id] = agg;
        setProgress({ done: i + 1, total: candidates.length });
      }
      if (runToken.current !== token) return;
      setSim({ sig, aggregates });
    } catch (e) {
      if (runToken.current !== token) return;
      setMessage(e instanceof DOMException && e.name === 'AbortError' ? s.cancelled : s.failed);
    } finally {
      if (runToken.current === token) {
        handle.current = null;
        setProgress(null);
      }
    }
  };

  const create = (cand: Play): void => {
    const offense = given?.side === 'offense' ? given.id : cand.id;
    const defense = given?.side === 'offense' ? cand.id : given?.id;
    navigate(`/matchup/new?offense=${offense}&defense=${defense}`);
  };

  const formats = [...new Set(pickable.map((p) => p.format))];
  const routeNames = t.offense.routeNames as Record<string, string>;

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="suggest-page">
      <h1 className="text-xl font-semibold">{s.title}</h1>
      <fieldset className="flex gap-4">
        <legend className="text-sm font-medium">{s.direction}</legend>
        {(
          [
            ['offense-vs-coverage', s.offense, 'sg-dir-offense'],
            ['defense-vs-play', s.defense, 'sg-dir-defense'],
          ] as const
        ).map(([value, label, id]) => (
          <label key={value} className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="sg-direction"
              data-testid={id}
              checked={direction === value}
              onChange={() => {
                setDirection(value);
                setPlayId('');
                setLineupId('');
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <Select
          label={direction === 'offense-vs-coverage' ? s.playOffense : s.playDefense}
          data-testid="sg-play"
          value={given ? given.id : ''}
          onChange={(e) => {
            setPlayId(e.target.value);
            setLineupId('');
          }}
        >
          <option value="">{s.choosePlay}</option>
          {formats.map((f) => (
            <optgroup key={f} label={s.format(f)}>
              {pickable
                .filter((p) => p.format === f)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <Select
          label={s.lineup}
          data-testid="sg-lineup"
          value={activeLineup ?? ''}
          onChange={(e) => setLineupId(e.target.value)}
          disabled={!given}
        >
          <option value="">{s.noLineup}</option>
          {lineupOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      {!given ? (
        <p data-testid="sg-hint">{s.pickPrompt}</p>
      ) : (
        <section className="flex flex-col gap-3" data-testid="sg-results">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">{s.results}</h2>
            <span className="text-xs text-slate-500">{simResults ? s.simTier : s.tagTier}</span>
            <Button
              data-testid="sg-run-sim"
              size="sm"
              variant="primary"
              disabled={running || tagResults.length === 0}
              onClick={() => void runSim()}
            >
              {s.runSim}
            </Button>
            {running && (
              <>
                <progress
                  data-testid="sg-progress"
                  value={progress.done}
                  max={progress.total}
                  aria-label={s.progress(progress.done, progress.total)}
                />
                <span data-testid="sg-progress-text">{s.progress(progress.done, progress.total)}</span>
                <Button data-testid="sg-cancel" size="sm" onClick={cancel}>
                  {s.cancel}
                </Button>
              </>
            )}
          </div>
          {message !== null && (
            <p role="status" data-testid="sg-message">
              {message}
            </p>
          )}
          {shown.length === 0 && <p data-testid="sg-empty">{s.empty}</p>}
          <ol className="flex flex-col gap-3">
            {shown.map((x, i) => (
              <li
                key={x.play.id}
                data-testid={`sg-row-${x.play.id}`}
                className="flex items-center gap-3 rounded border p-2"
              >
                <span className="w-6 text-lg font-semibold">{i + 1}</span>
                {snapshot && (
                  <PlayThumbnail
                    play={x.play}
                    field={snapshot.settings.fields[x.play.format]}
                    width={120}
                    height={80}
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium">{x.play.name}</div>
                  <div className="text-sm">
                    {s.scoreLabel}: <span data-testid={`sg-score-${x.play.id}`}>{x.score.toFixed(2)}</span>
                  </div>
                  <ul data-testid={`sg-reasons-${x.play.id}`} className="text-sm text-slate-600">
                    {x.reasons.map((r, j) => (
                      <li key={j}>{reasonText(r, routeNames)}</li>
                    ))}
                  </ul>
                </div>
                <Button data-testid={`sg-create-${x.play.id}`} size="sm" onClick={() => create(x.play)}>
                  {s.create}
                </Button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
