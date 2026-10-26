/** FR-IO-05: banner when the last export is older than 14 days (or never, once data exists). */
import { useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useDbSnapshot, useInstalls, useMatchups, usePlays } from '@/db/hooks';
import { t } from '@/i18n/vi';
import { downloadExport, exportAll } from '@/lib/io/exportData';

export const BACKUP_REMINDER_DAYS = 14;
const DISMISS_KEY = 'flagbook.backupBannerDismissed';
const DAY_MS = 86_400_000;

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

const isUser = (x: { id: string }): boolean => !x.id.startsWith('seed-');

export function BackupBanner(): JSX.Element | null {
  const plays = usePlays();
  const matchups = useMatchups();
  const installs = useInstalls();
  const snapshot = useDbSnapshot();
  const inRouter = useInRouterContext();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  if (dismissed || !plays || !matchups || !installs || !snapshot) return null;
  const hasUserData = plays.some(isUser) || matchups.some(isUser) || installs.some(isUser);
  if (!hasUserData) return null;
  const last = snapshot.settings.lastExportAt;
  if (last !== undefined && Date.now() - last <= BACKUP_REMINDER_DAYS * DAY_MS) return null;

  const dismiss = (): void => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sessionStorage unavailable: dismiss for this mount only.
    }
    setDismissed(true);
  };
  const exportNow = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadExport(await exportAll());
    } finally {
      setBusy(false);
    }
  };
  const s = t.exportx.banner;
  const linkCls = 'font-medium underline';
  return (
    <div
      role="status"
      data-testid="backup-banner"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs sm:gap-3 sm:px-4 sm:py-2 sm:text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="min-w-0 flex-1 basis-full break-words sm:basis-48">
        {s.text}{' '}
        {inRouter ? (
          <Link to="/settings" className={linkCls}>
            {s.settings}
          </Link>
        ) : (
          <a href="/settings" className={linkCls}>
            {s.settings}
          </a>
        )}
      </span>
      <Button
        variant="primary"
        data-testid="backup-export-now"
        disabled={busy}
        onClick={() => void exportNow()}
      >
        {busy ? s.exporting : s.exportNow}
      </Button>
      <Button data-testid="backup-dismiss" onClick={dismiss}>
        {s.dismiss}
      </Button>
    </div>
  );
}
