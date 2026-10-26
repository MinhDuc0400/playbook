/** Install detail: ordered matchups with coach notes (SRS §12.1, FR-IN-01..03). */
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, IconButton } from '@/components/ui';
import { useInstall, useMatchups, usePlays } from '@/db/hooks';
import { installsRepo } from '@/db/repos/installs';
import type { ID, Install } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useAutoSave } from '@/lib/useAutoSave';
import { downloadBlob } from '@/lib/export/download';
import { exportInstallPdf } from '@/lib/export/pdf';
import { exportInstallBundle } from '@/lib/export/selective';
import { serializeExport } from '@/lib/io/exportData';
import { addItems, moveItem, removeItem, setNote, sortedItems } from './items';
import { MatchupPicker, matchupLabel } from './MatchupPicker';

const fieldCls =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function InstallEditor({ initial }: { initial: Install }): JSX.Element {
  const [working, setWorking] = useState<Install>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragId, setDragId] = useState<ID | null>(null);
  const autosave = useAutoSave(working, (i) => installsRepo.put({ ...i, updatedAt: Date.now() }));
  const matchups = useMatchups();
  const plays = usePlays();
  const matchupMap = useMemo(() => new Map((matchups ?? []).map((m) => [m.id, m])), [matchups]);
  const playMap = useMemo(() => new Map((plays ?? []).map((p) => [p.id, p])), [plays]);
  const items = sortedItems(working);
  const [exportError, setExportError] = useState(false);
  const runExport = async (fn: () => Promise<void>): Promise<void> => {
    setExportError(false);
    try {
      await fn();
    } catch {
      setExportError(true);
    }
  };
  const exportJson = (): Promise<void> =>
    runExport(async () => {
      const file = await exportInstallBundle(working.id);
      const { json } = serializeExport(file);
      downloadBlob(new Blob([json], { type: 'application/json' }), `${working.name || 'install'}.json`);
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4" data-testid="install-detail-page">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/install" className="text-blue-700 underline dark:text-blue-300">
          {t.install.back}
        </Link>
        <span data-testid="install-save-status" className="text-sm text-slate-600 dark:text-slate-300">
          {t.common.saveStatus[autosave.status]}
        </span>
        <Link
          to={`/install/${working.id}/present`}
          data-testid="install-present"
          className="ml-auto inline-flex min-h-10 items-center rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white lg:min-h-0"
        >
          {t.install.present}
        </Link>
        <Button data-testid="install-export-json" onClick={() => void exportJson()}>
          {t.exportx.json.button}
        </Button>
        <Button
          data-testid="install-export-pdf"
          onClick={() => void runExport(() => exportInstallPdf(working.id))}
        >
          {t.exportx.pdf.button}
        </Button>
      </div>
      {exportError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t.exportx.pdf.failed}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t.install.name}
        <input
          data-testid="install-name"
          className={fieldCls}
          value={working.name}
          onChange={(e) => setWorking((w) => ({ ...w, name: e.target.value }))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t.install.description}
        <input
          data-testid="install-desc"
          className={fieldCls}
          value={working.description ?? ''}
          onChange={(e) => setWorking((w) => ({ ...w, description: e.target.value }))}
        />
      </label>
      <div>
        <Button variant="primary" data-testid="install-add" onClick={() => setPickerOpen(true)}>
          {t.install.add}
        </Button>
      </div>
      {items.length === 0 ? <p>{t.install.noItems}</p> : null}
      <ol className="flex flex-col gap-3">
        {items.map((it, idx) => {
          const m = matchupMap.get(it.matchupId);
          return (
            <li
              key={it.id}
              data-testid={`install-item-${it.id}`}
              draggable
              onDragStart={(e) => {
                setDragId(it.id);
                e.dataTransfer?.setData('text/plain', it.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== it.id) setWorking((w) => moveItem(w, dragId, idx));
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden title={t.install.drag} className="hidden cursor-grab select-none lg:inline">
                  ⠿
                </span>
                <span className="w-6 text-slate-500">{idx + 1}</span>
                {m ? (
                  <span className="min-w-0 flex-1 basis-40 break-words font-medium">
                    {matchupLabel(m, playMap)}
                  </span>
                ) : (
                  <span role="alert" className="min-w-0 flex-1 basis-40 text-red-700 dark:text-red-300">
                    {t.install.missingMatchup}
                  </span>
                )}
                <IconButton
                  label={t.install.moveUp}
                  data-testid={`install-up-${it.id}`}
                  disabled={idx === 0}
                  onClick={() => setWorking((w) => moveItem(w, it.id, idx - 1))}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={t.install.moveDown}
                  data-testid={`install-down-${it.id}`}
                  disabled={idx === items.length - 1}
                  onClick={() => setWorking((w) => moveItem(w, it.id, idx + 1))}
                >
                  ↓
                </IconButton>
                <IconButton
                  label={t.install.remove}
                  variant="danger"
                  data-testid={`install-remove-${it.id}`}
                  onClick={() => setWorking((w) => removeItem(w, it.id))}
                >
                  ×
                </IconButton>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t.install.coachNote}
                <textarea
                  data-testid={`install-note-${it.id}`}
                  className={fieldCls}
                  rows={3}
                  placeholder={t.install.notePlaceholder}
                  value={it.coachNote ?? ''}
                  onChange={(e) => setWorking((w) => setNote(w, it.id, e.target.value))}
                />
              </label>
            </li>
          );
        })}
      </ol>
      <MatchupPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(ids) => {
          setWorking((w) => addItems(w, ids, nanoid));
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

export default function InstallDetailPage(): JSX.Element {
  const { id } = useParams();
  const install = useInstall(id);
  if (install === undefined) return <p className="p-6">{t.common.loading}</p>;
  if (install === null) {
    return (
      <div className="p-6" data-testid="install-not-found">
        <p>{t.install.notFound}</p>
        <Link to="/install" className="text-blue-700 underline dark:text-blue-300">
          {t.install.back}
        </Link>
      </div>
    );
  }
  return <InstallEditor key={id} initial={install} />;
}
