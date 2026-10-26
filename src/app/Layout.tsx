/** App frame: top nav (Playbook, Install, Roster, Suggest, Cài đặt), DbErrorBanner, <Outlet/>, "?" shortcut sheet. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { IconButton } from '@/components/ui';
import { t } from '@/i18n/vi';
import { BackupBanner } from './BackupBanner';
import { DbErrorBanner } from './DbErrorBanner';
import { ShortcutSheet } from './ShortcutSheet';

const NAV = [
  { to: '/', id: 'playbook', label: t.common.nav.playbook, end: true },
  { to: '/install', id: 'install', label: t.common.nav.install, end: false },
  { to: '/roster', id: 'roster', label: t.common.nav.roster, end: false },
  { to: '/suggest', id: 'suggest', label: t.common.nav.suggest, end: false },
  { to: '/settings', id: 'settings', label: t.common.nav.settings, end: false },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function Layout(): JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setSheetOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
        <span className="text-lg font-bold">{t.common.appName}</span>
        <nav aria-label={t.common.nav.label} className="flex flex-1 items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.id}`}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <IconButton label={t.common.shortcuts.open} onClick={() => setSheetOpen(true)}>
          ?
        </IconButton>
      </header>
      <DbErrorBanner />
      <BackupBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <ShortcutSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
