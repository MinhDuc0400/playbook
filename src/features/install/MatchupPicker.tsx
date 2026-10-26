/** Dialog to pick matchups to add to an Install (FR-IN-02). */
import { useMemo, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { useMatchups, usePlays } from '@/db/hooks';
import type { ID, Matchup, Play } from '@/domain/types';
import { t } from '@/i18n/vi';

export interface MatchupPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (matchupIds: ID[]) => void;
}

/** Display name: custom name, else "Offense vs Defense", else a missing-play fallback. */
export function matchupLabel(m: Matchup, plays: Map<ID, Play>): string {
  if (m.name) return m.name;
  const o = plays.get(m.offensePlayId)?.name ?? '?';
  const d = plays.get(m.defensePlayId)?.name ?? '?';
  return `${o} ${t.install.vs} ${d}`;
}

export function MatchupPicker({ open, onClose, onPick }: MatchupPickerProps): JSX.Element | null {
  const matchups = useMatchups();
  const plays = usePlays();
  const [selected, setSelected] = useState<ID[]>([]);
  const playMap = useMemo(() => new Map((plays ?? []).map((p) => [p.id, p])), [plays]);

  const toggle = (id: ID): void =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const close = (): void => {
    setSelected([]);
    onClose();
  };
  const confirm = (): void => {
    onPick(selected);
    setSelected([]);
  };

  return (
    <Dialog open={open} onClose={close} title={t.install.pickerTitle}>
      {matchups && matchups.length === 0 ? <p>{t.install.pickerEmpty}</p> : null}
      <ul className="flex flex-col gap-1">
        {(matchups ?? []).map((m) => (
          <li key={m.id}>
            <label className="flex min-h-[44px] items-center gap-3 break-words">
              <input
                type="checkbox"
                data-testid={`picker-${m.id}`}
                className="h-5 w-5 shrink-0"
                checked={selected.includes(m.id)}
                onChange={() => toggle(m.id)}
              />
              {matchupLabel(m, playMap)}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button onClick={close}>{t.install.cancel}</Button>
        <Button variant="primary" data-testid="picker-confirm" onClick={confirm}>
          {t.install.pickerConfirm}
        </Button>
      </div>
    </Dialog>
  );
}
