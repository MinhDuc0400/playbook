/**
 * One play in the Playbook grid (FR-PB-01, FR-PB-03, FR-PB-05): thumbnail, name, side/format/formation,
 * tags, matchup count, actions open / duplicate / delete (DeletePlayDialog, FR-DAT-02) / create matchup.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { PlayThumbnail } from '@/components/field/PlayThumbnail';
import { playsRepo } from '@/db/repos/plays';
import type { FieldConfig, Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { DeletePlayDialog } from './DeletePlayDialog';

export interface PlayCardProps {
  play: Play;
  field: FieldConfig;
  matchupCount: number;
}

const badge =
  'rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200';

export function PlayCard({ play, field, matchupCount }: PlayCardProps): JSX.Element {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = t.playbookActions.card;

  const duplicate = async (): Promise<void> => {
    setError(null);
    try {
      await playsRepo.duplicate(play.id);
    } catch {
      setError(s.duplicateFailed);
    }
  };

  const createMatchup = (): void => {
    const key = play.side === 'offense' ? 'offense' : 'defense';
    navigate(`/matchup/new?${key}=${encodeURIComponent(play.id)}`);
  };

  return (
    <article
      data-testid={`card-${play.id}`}
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      <Link
        to={`/play/${play.id}`}
        data-testid={`card-open-${play.id}`}
        aria-label={`${s.open}: ${play.name}`}
        className="block overflow-hidden rounded-md"
      >
        <PlayThumbnail play={play} field={field} className="mx-auto max-w-full" />
      </Link>
      <h3 className="truncate text-base font-semibold">{play.name}</h3>
      <div className="flex flex-wrap items-center gap-1">
        <span className={badge}>{play.side === 'offense' ? 'Offense' : 'Defense'}</span>
        <span className={badge}>{play.format}</span>
        <span className={badge}>{play.formation}</span>
        <span
          className={badge}
          data-testid={`card-mcount-${play.id}`}
          title={s.matchupCountLabel(matchupCount)}
        >
          {s.matchupCount(matchupCount)}
        </span>
      </div>
      {play.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {play.tags.map((tag) => (
            <span key={tag} className={badge}>
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-1">
        <Button size="sm" data-testid={`card-duplicate-${play.id}`} onClick={() => void duplicate()}>
          {s.duplicate}
        </Button>
        <Button size="sm" data-testid={`card-matchup-${play.id}`} onClick={createMatchup}>
          {s.createMatchup}
        </Button>
        <Button
          size="sm"
          variant="danger"
          data-testid={`card-delete-${play.id}`}
          onClick={() => setDeleting(true)}
        >
          {s.delete}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {deleting && <DeletePlayDialog play={play} open onClose={() => setDeleting(false)} />}
    </article>
  );
}
