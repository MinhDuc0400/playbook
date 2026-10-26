/** Delete a play; when matchups use it, list them and offer cancel or cascade (FR-DAT-02). */
import { useEffect, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { deletePlay, getPlayDeleteImpact, type PlayDeleteImpact } from '@/db/repos/cascade';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';

export interface DeletePlayDialogProps {
  play: Play;
  open: boolean;
  onClose: () => void;
}

export function DeletePlayDialog({ play, open, onClose }: DeletePlayDialogProps): JSX.Element | null {
  const s = t.playbookActions.deleteDialog;
  const [impact, setImpact] = useState<PlayDeleteImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setImpact(null);
    setError(null);
    getPlayDeleteImpact(play.id).then(
      (i) => {
        if (!cancelled) setImpact(i);
      },
      () => {
        if (!cancelled) setError(s.failed);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, play.id, s.failed]);

  const run = async (cascade: boolean): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await deletePlay(play.id, { cascade });
      onClose();
    } catch {
      setError(s.failed);
      setBusy(false);
    }
  };

  const used = impact !== null && impact.matchups.length > 0;

  return (
    <Dialog open={open} onClose={onClose} title={s.title}>
      <div className="flex flex-col gap-3" data-testid="delete-dialog">
        {impact === null && !error && <p>{s.loading}</p>}
        {impact !== null && !used && <p>{s.confirm(play.name)}</p>}
        {used && (
          <>
            <p>{s.inUse(play.name, impact.matchups.length)}</p>
            <ul className="list-disc pl-5">
              {impact.matchups.map((m) => (
                <li key={m.id} data-testid={`delete-impact-${m.id}`}>
                  {m.name ?? m.id}
                </li>
              ))}
            </ul>
            {impact.installs.length > 0 && (
              <>
                <p>{s.installsHeading}</p>
                <ul className="list-disc pl-5">
                  {impact.installs.map(({ install, itemIds }) => (
                    <li key={install.id} data-testid={`delete-install-${install.id}`}>
                      {install.name} ({s.installItems(itemIds.length)})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button data-testid="delete-cancel" onClick={onClose}>
            {s.cancel}
          </Button>
          {impact !== null && !used && (
            <Button
              variant="danger"
              data-testid="delete-confirm"
              disabled={busy}
              onClick={() => void run(false)}
            >
              {s.confirmButton}
            </Button>
          )}
          {used && (
            <Button
              variant="danger"
              data-testid="delete-cascade"
              disabled={busy}
              onClick={() => void run(true)}
            >
              {s.cascade}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
