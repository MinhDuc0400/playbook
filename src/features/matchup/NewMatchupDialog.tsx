/** New-matchup dialog (FR-MU-01): one offense play + one defense play of the same format. */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Select } from '@/components/ui';
import { usePlays } from '@/db/hooks';
import { matchupsRepo } from '@/db/repos/matchups';
import { t } from '@/i18n/vi';
import { createMatchup } from './buildSimInput';

export interface NewMatchupDialogProps {
  open: boolean;
  /** Prefill from `?offense=` / `?defense=`. */
  initialOffenseId?: string;
  initialDefenseId?: string;
  onClose(): void;
}

const s = t.matchup.newMatchup;

export function NewMatchupDialog({
  open,
  initialOffenseId = '',
  initialDefenseId = '',
  onClose,
}: NewMatchupDialogProps): JSX.Element | null {
  const navigate = useNavigate();
  const plays = usePlays();
  const [offenseId, setOffenseId] = useState(initialOffenseId);
  const [defenseId, setDefenseId] = useState(initialDefenseId);
  const [busy, setBusy] = useState(false);

  const offensePlays = (plays ?? []).filter((p) => p.side === 'offense');
  const defensePlays = (plays ?? []).filter((p) => p.side === 'defense');
  const offense = offensePlays.find((p) => p.id === offenseId);
  // A prefilled / stale defense of another format counts as not chosen.
  const defenseRaw = defensePlays.find((p) => p.id === defenseId);
  const defense = defenseRaw && (!offense || offense.format === defenseRaw.format) ? defenseRaw : undefined;
  const offenseOptions = offensePlays.filter((p) => !defense || p.format === defense.format);
  const defenseOptions = defensePlays.filter((p) => !offense || p.format === offense.format);

  const create = async (): Promise<void> => {
    if (busy || !offense || !defense) return;
    setBusy(true);
    try {
      const m = createMatchup({
        offensePlayId: offense.id,
        defensePlayId: defense.id,
        now: Date.now(),
        idGen: nanoid,
        seed: 1,
      });
      await matchupsRepo.put(m);
      navigate(`/matchup/${m.id}`, { replace: true });
    } catch {
      // Storage failures are surfaced by the DbErrorBanner; let the user retry.
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={s.title}>
      {plays === undefined ? (
        <p>{s.loading}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Select
            label={s.offense}
            data-testid="new-matchup-offense"
            value={offense?.id ?? ''}
            onChange={(e) => setOffenseId(e.target.value)}
          >
            <option value="">{s.choose}</option>
            {offenseOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.name} (${p.format})`}
              </option>
            ))}
          </Select>
          <Select
            label={s.defense}
            data-testid="new-matchup-defense"
            value={defense?.id ?? ''}
            onChange={(e) => setDefenseId(e.target.value)}
          >
            <option value="">{s.choose}</option>
            {defenseOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.name} (${p.format})`}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500 dark:text-slate-400">{s.formatHint}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" data-testid="new-matchup-cancel" onClick={onClose}>
              {s.cancel}
            </Button>
            <Button type="submit" data-testid="new-matchup-create" disabled={!offense || !defense || busy}>
              {s.create}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
