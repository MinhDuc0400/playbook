/** Banner shown when an IndexedDB error was reported (NFR-REL-02): clear message + export suggestion. */
import { useEffect, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { onDbError, type DbErrorInfo } from '@/db/errors';
import { t } from '@/i18n/vi';

function SettingsLink({ children }: { children: string }): JSX.Element {
  const inRouter = useInRouterContext();
  const cls = 'font-medium underline';
  return inRouter ? (
    <Link to="/settings" className={cls}>
      {children}
    </Link>
  ) : (
    <a href="/settings" className={cls}>
      {children}
    </a>
  );
}

export function DbErrorBanner(): JSX.Element | null {
  const [info, setInfo] = useState<DbErrorInfo | null>(null);

  useEffect(() => onDbError(setInfo), []);

  if (!info) return null;
  return (
    <div
      role="alert"
      data-testid="db-error-banner"
      className="flex items-start justify-between gap-3 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
    >
      <div>
        <p className="font-semibold">{t.common.dbError[info.kind]}</p>
        <p>
          {t.common.dbError.exportHint} <SettingsLink>{t.common.dbError.exportLink}</SettingsLink>
        </p>
      </div>
      <button
        type="button"
        aria-label={t.common.dbError.dismiss}
        title={t.common.dbError.dismiss}
        onClick={() => setInfo(null)}
        className="rounded px-2 text-lg leading-none hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-red-900"
      >
        ×
      </button>
    </div>
  );
}
