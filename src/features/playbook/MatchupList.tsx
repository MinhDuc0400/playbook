/** Matchup tab of the Playbook (FR-PB-04): double thumbnails, filter by offense / defense play. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayThumbnail } from '@/components/field/PlayThumbnail';
import { Button, Select } from '@/components/ui';
import { useMatchups } from '@/db/hooks';
import { deleteMatchup } from '@/db/repos/cascade';
import { applyMatchupFlips } from '@/domain/matchupFlip';
import type { Matchup, Play, Settings } from '@/domain/types';
import { t } from '@/i18n/vi';

export interface MatchupListProps {
  plays: readonly Play[];
  settings: Settings;
}

const THUMB_W = 200;
const THUMB_H = 133;

export function MatchupList({ plays, settings }: MatchupListProps): JSX.Element {
  const s = t.playbookActions.matchupList;
  const matchups = useMatchups();
  const [offenseId, setOffenseId] = useState('');
  const [defenseId, setDefenseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(plays.map((p) => [p.id, p])), [plays]);
  const offensePlays = useMemo(() => plays.filter((p) => p.side === 'offense'), [plays]);
  const defensePlays = useMemo(() => plays.filter((p) => p.side === 'defense'), [plays]);

  const visible = useMemo(
    () =>
      (matchups ?? [])
        .filter(
          (m) =>
            (offenseId === '' || m.offensePlayId === offenseId) &&
            (defenseId === '' || m.defensePlayId === defenseId),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [matchups, offenseId, defenseId],
  );

  const remove = async (m: Matchup, label: string): Promise<void> => {
    if (!window.confirm(s.confirmDelete(label))) return;
    setError(null);
    try {
      await deleteMatchup(m.id);
    } catch {
      setError(s.deleteFailed);
    }
  };

  if (!matchups) return <p>{t.common.loading}</p>;

  return (
    <div className="flex flex-col gap-4" data-testid="matchup-list">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label={s.filterOffense}
          data-testid="mfilter-offense"
          value={offenseId}
          onChange={(e) => setOffenseId(e.target.value)}
        >
          <option value="">{s.filterAll}</option>
          {offensePlays.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          label={s.filterDefense}
          data-testid="mfilter-defense"
          value={defenseId}
          onChange={(e) => setDefenseId(e.target.value)}
        >
          <option value="">{s.filterAll}</option>
          {defensePlays.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {visible.length === 0 ? (
        <p data-testid="matchup-empty" className="py-8 text-center text-slate-600 dark:text-slate-300">
          {matchups.length === 0 ? s.empty : s.emptyFiltered}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((m) => {
            const offense = byId.get(m.offensePlayId);
            const defense = byId.get(m.defensePlayId);
            const label = m.name ?? s.versus(offense?.name ?? s.unknownPlay, defense?.name ?? s.unknownPlay);
            const shown = offense && defense ? applyMatchupFlips(offense, defense, m) : null;
            return (
              <li
                key={m.id}
                data-testid={`mrow-${m.id}`}
                className="flex flex-col gap-3 rounded-lg sm:flex-row sm:flex-wrap sm:items-center border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {shown && offense && defense ? (
                  <Link
                    to={`/matchup/${m.id}`}
                    data-testid={`mrow-open-${m.id}`}
                    aria-label={`${s.open}: ${label}`}
                    className="flex min-w-0 max-w-full gap-2"
                  >
                    <PlayThumbnail
                      play={offense}
                      field={settings.fields[offense.format]}
                      flipped={m.offenseFlipped}
                      width={THUMB_W}
                      height={THUMB_H}
                      className="min-w-0 max-w-[calc(50%-0.25rem)] !h-auto"
                    />
                    <PlayThumbnail
                      play={defense}
                      field={settings.fields[defense.format]}
                      flipped={shown.defenseFlipped}
                      width={THUMB_W}
                      height={THUMB_H}
                      className="min-w-0 max-w-[calc(50%-0.25rem)] !h-auto"
                    />
                  </Link>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    to={`/matchup/${m.id}`}
                    {...(shown ? {} : { 'data-testid': `mrow-open-${m.id}` })}
                    className="truncate font-semibold hover:underline"
                  >
                    {label}
                  </Link>
                  {!shown && (
                    <p
                      data-testid={`mrow-missing-${m.id}`}
                      role="alert"
                      className="text-sm text-red-700 dark:text-red-300"
                    >
                      {s.missingPlay}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  className="self-start sm:self-auto"
                  data-testid={`mrow-delete-${m.id}`}
                  onClick={() => void remove(m, label)}
                >
                  {s.delete}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
