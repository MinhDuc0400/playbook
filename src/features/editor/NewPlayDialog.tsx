/** New-play dialog (FR-ED-01): side, format, blank or preset formation. */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Select } from '@/components/ui';
import { playsRepo } from '@/db/repos/plays';
import { createPlay, formationsFor } from '@/domain/formations';
import type { Format, Side } from '@/domain/types';
import { t } from '@/i18n/vi';

export interface NewPlayDialogProps {
  open: boolean;
  /** Initial format (Settings.defaultFormat). */
  defaultFormat: Format;
  /** Cancel / Esc / backdrop. */
  onClose(): void;
}

const FORMATS: Format[] = ['5v5', '7v7', 'custom'];
const SIDES: Side[] = ['offense', 'defense'];

export function NewPlayDialog({ open, defaultFormat, onClose }: NewPlayDialogProps): JSX.Element | null {
  const navigate = useNavigate();
  const [side, setSide] = useState<Side>('offense');
  const [format, setFormat] = useState<Format>(defaultFormat);
  const [formationId, setFormationId] = useState('');
  const [busy, setBusy] = useState(false);

  const formations = formationsFor(side, format);

  const create = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const play = createPlay({
        side,
        format,
        formationId: formationId === '' ? null : formationId,
        now: Date.now(),
        idGen: nanoid,
      });
      await playsRepo.put(play);
      navigate(`/play/${play.id}`, { replace: true });
    } catch {
      // Storage failures are surfaced by the DbErrorBanner; let the user retry.
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t.editor.newPlay.title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t.editor.newPlay.side}
          </legend>
          <div className="flex gap-4">
            {SIDES.map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="new-play-side"
                  data-testid={`new-play-side-${s}`}
                  checked={side === s}
                  onChange={() => {
                    setSide(s);
                    setFormationId('');
                  }}
                />
                {t.editor.sides[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <Select
          label={t.editor.newPlay.format}
          data-testid="new-play-format"
          value={format}
          onChange={(e) => {
            setFormat(e.target.value as Format);
            setFormationId('');
          }}
        >
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.editor.formats[f]}
            </option>
          ))}
        </Select>
        <Select
          label={t.editor.newPlay.formation}
          data-testid="new-play-formation"
          value={formationId}
          onChange={(e) => setFormationId(e.target.value)}
        >
          <option value="">{t.editor.newPlay.blank}</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button data-testid="new-play-cancel" onClick={onClose}>
            {t.editor.newPlay.cancel}
          </Button>
          <Button type="submit" variant="primary" data-testid="new-play-create" disabled={busy}>
            {t.editor.newPlay.create}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
