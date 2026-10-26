/** "Thêm vào Install" button for the Matchup page (FR-IN-02). */
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { Button, Dialog, TextInput } from '@/components/ui';
import { useInstalls } from '@/db/hooks';
import { installsRepo } from '@/db/repos/installs';
import { SCHEMA_VERSION, type ID, type Install } from '@/domain/types';
import { t } from '@/i18n/vi';
import { addItems } from './items';

export function AddToInstallButton({ matchupId }: { matchupId: ID }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const installs = useInstalls();

  const append = async (inst: Install): Promise<void> => {
    await installsRepo.put({ ...addItems(inst, [matchupId], nanoid), updatedAt: Date.now() });
    setOpen(false);
  };
  const createAndAdd = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const inst: Install = {
      id: nanoid(),
      schemaVersion: SCHEMA_VERSION,
      name: trimmed,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    setName('');
    await append(inst);
  };

  return (
    <>
      <Button data-testid="btn-add-to-install" onClick={() => setOpen(true)}>
        {t.install.addToInstall}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.install.addToInstallTitle}>
        {installs && installs.length === 0 ? <p>{t.install.addToInstallNone}</p> : null}
        <ul className="flex flex-col gap-1">
          {(installs ?? []).map((i) => (
            <li key={i.id}>
              <Button
                className="w-full justify-start"
                data-testid={`add-to-install-${i.id}`}
                onClick={() => void append(i)}
              >
                {i.name}
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-40">
            <TextInput
              label={t.install.addToInstallNew}
              data-testid="add-to-install-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button variant="primary" data-testid="add-to-install-new" onClick={() => void createAndAdd()}>
            {t.install.addToInstallCreate}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
