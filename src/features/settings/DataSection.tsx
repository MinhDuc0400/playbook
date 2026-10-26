/** Settings → Dữ liệu: JSON export / import (FR-IO-01..03). */
import { useState } from 'react';
import { Button, Dialog, Select } from '@/components/ui';
import { useSettings } from '@/db/hooks';
import { t } from '@/i18n/vi';
import { downloadExport, exportAll } from '@/lib/io/exportData';
import {
  importData,
  parseImport,
  type ImportMode,
  type ImportReport,
  type MergeStrategy,
} from '@/lib/io/importData';

const TABLES = ['plays', 'athletes', 'lineups', 'matchups', 'installs', 'settings'] as const;

export function DataSection(): JSX.Element {
  const settings = useSettings();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [strategy, setStrategy] = useState<MergeStrategy>('newer');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const onExport = async (): Promise<void> => {
    setErrors([]);
    try {
      await downloadExport(await exportAll());
    } catch {
      setErrors([t.settings.data.exportFailed]);
    }
  };

  const run = async (): Promise<void> => {
    if (!file) return;
    setBusy(true);
    setReport(null);
    setErrors([]);
    try {
      const parsed = parseImport(await file.text());
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      setReport(await importData(parsed.file, mode, strategy));
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
    }
  };

  const onImport = (): void => {
    if (!file) {
      setErrors([t.settings.data.noFile]);
      return;
    }
    if (mode === 'replace') setConfirming(true);
    else void run();
  };

  const lastExport = settings?.lastExportAt;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t.settings.data.intro}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" data-testid="btn-export" onClick={() => void onExport()}>
          {t.settings.data.export}
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-300" data-testid="last-export">
          {lastExport
            ? t.settings.data.lastExport(new Date(lastExport).toLocaleString('vi-VN'))
            : t.settings.data.neverExported}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-medium">{t.settings.data.importHeading}</h3>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t.settings.data.file}
          <input
            type="file"
            accept=".json,application/json"
            data-testid="import-file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setErrors([]);
            }}
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">{t.settings.data.mode}</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="import-mode"
              data-testid="import-mode-merge"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            {t.settings.data.modeMerge}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="import-mode"
              data-testid="import-mode-replace"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            {t.settings.data.modeReplace}
          </label>
        </fieldset>
        {mode === 'merge' ? (
          <Select
            label={t.settings.data.strategy}
            data-testid="import-strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as MergeStrategy)}
          >
            <option value="newer">{t.settings.data.strategyNewer}</option>
            <option value="copy">{t.settings.data.strategyCopy}</option>
          </Select>
        ) : null}
        <div>
          <Button variant="primary" data-testid="btn-import" disabled={busy} onClick={onImport}>
            {busy ? t.settings.data.importing : t.settings.data.import}
          </Button>
        </div>
      </div>

      {errors.length > 0 ? (
        <div role="alert" data-testid="import-errors" className="text-sm text-red-700 dark:text-red-400">
          <p className="font-medium">{t.settings.data.errorsTitle}</p>
          <ul className="list-disc pl-5">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report ? (
        <div data-testid="import-report">
          <h3 className="mb-1 font-medium">{t.settings.data.reportTitle}</h3>
          <table className="text-sm">
            <thead>
              <tr className="text-left">
                <th className="pr-4">{t.settings.data.columns.table}</th>
                <th className="pr-4">{t.settings.data.columns.added}</th>
                <th className="pr-4">{t.settings.data.columns.updated}</th>
                <th>{t.settings.data.columns.skipped}</th>
              </tr>
            </thead>
            <tbody>
              {TABLES.map((name) => (
                <tr key={name} data-testid={`import-report-${name}`}>
                  <td className="pr-4">{t.settings.data.tables[name]}</td>
                  <td className="pr-4">{report[name].added}</td>
                  <td className="pr-4">{report[name].updated}</td>
                  <td>{report[name].skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t.settings.data.confirmTitle}>
        <div data-testid="import-confirm">
          <p className="mb-4">{t.settings.data.confirmBody}</p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirming(false)}>{t.settings.data.cancel}</Button>
            <Button
              variant="danger"
              data-testid="import-confirm-yes"
              onClick={() => {
                setConfirming(false);
                void run();
              }}
            >
              {t.settings.data.confirmYes}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
