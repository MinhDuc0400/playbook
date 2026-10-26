/** Install list (SRS §12.1, FR-IN-01). */
import { nanoid } from 'nanoid';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Dialog, TextInput } from '@/components/ui';
import { useInstalls } from '@/db/hooks';
import { installsRepo } from '@/db/repos/installs';
import { SCHEMA_VERSION, type Install } from '@/domain/types';
import { t } from '@/i18n/vi';

export default function InstallListPage(): JSX.Element {
  const installs = useInstalls();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [toDelete, setToDelete] = useState<Install | null>(null);

  const create = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const inst: Install = {
      id: nanoid(),
      schemaVersion: SCHEMA_VERSION,
      name: trimmed,
      ...(desc.trim() ? { description: desc.trim() } : {}),
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    await installsRepo.put(inst);
    navigate(`/install/${inst.id}`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4" data-testid="install-list-page">
      <h1 className="text-xl font-semibold">{t.install.title}</h1>
      <form onSubmit={(e) => void create(e)} className="flex flex-col gap-2 rounded-md border p-3">
        <TextInput
          label={t.install.newName}
          data-testid="install-new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label={t.install.newDesc}
          data-testid="install-new-desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div>
          <Button type="submit" variant="primary" data-testid="install-create" disabled={!name.trim()}>
            {t.install.create}
          </Button>
        </div>
      </form>
      {installs && installs.length === 0 ? <p>{t.install.empty}</p> : null}
      <ul className="flex flex-col gap-2">
        {(installs ?? []).map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <Link
              to={`/install/${i.id}`}
              data-testid={`install-row-${i.id}`}
              className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center break-words"
            >
              <span className="font-medium">{i.name}</span>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t.install.itemCount(i.items.length)}
              </span>
            </Link>
            <Button variant="danger" data-testid={`install-delete-${i.id}`} onClick={() => setToDelete(i)}>
              {t.install.delete}
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)} title={t.install.deleteTitle}>
        <p>{toDelete ? t.install.deleteConfirm(toDelete.name) : null}</p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setToDelete(null)}>{t.install.cancel}</Button>
          <Button
            variant="danger"
            data-testid="install-delete-confirm"
            onClick={() => {
              if (toDelete) void installsRepo.remove(toDelete.id);
              setToDelete(null);
            }}
          >
            {t.install.confirmDelete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
