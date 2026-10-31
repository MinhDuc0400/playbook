/** App frame: top nav (Playbook, Install, Roster, Suggest, Cài đặt), DbErrorBanner, <Outlet/>, "?" shortcut sheet. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFeatures } from '@/config/features';
import { IconButton } from '@/components/ui';
import { t } from '@/i18n/vi';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { BackupBanner } from './BackupBanner';
import { DbErrorBanner } from './DbErrorBanner';
import { ShortcutSheet } from './ShortcutSheet';

interface NavItem {
  to: string;
  id: string;
  label: string;
  end: boolean;
  flag?: 'showRoster' | 'showSuggest';
}

const NAV = [
  { to: '/', id: 'playbook', label: t.common.nav.playbook, end: true },
  { to: '/freestyle', id: 'freestyle', label: t.common.nav.freestyle, end: false },
  { to: '/install', id: 'install', label: t.common.nav.install, end: false },
  { to: '/roster', id: 'roster', label: t.common.nav.roster, end: false, flag: 'showRoster' },
  { to: '/suggest', id: 'suggest', label: t.common.nav.suggest, end: false, flag: 'showSuggest' },
  { to: '/settings', id: 'settings', label: t.common.nav.settings, end: false },
] as const satisfies readonly NavItem[];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

const linkBase =
  'whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const linkState = (isActive: boolean): string =>
  isActive
    ? 'bg-blue-600 text-white'
    : 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700';

function currentTitle(pathname: string): string {
  const hit = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return hit ? hit.label : '';
}

export function Layout(): JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const desktop = useIsDesktop();
  const { pathname } = useLocation();
  const features = useFeatures();
  const navItems: readonly NavItem[] = NAV.filter((n) => !('flag' in n) || features[n.flag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false);
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setSheetOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (desktop) setMenuOpen(false);
  }, [desktop]);

  const shortcutsButton = (
    <IconButton label={t.common.shortcuts.open} onClick={() => setSheetOpen(true)}>
      ?
    </IconButton>
  );

  return (
    <div className="flex min-h-screen min-w-0 max-w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {desktop ? (
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
          <span className="text-lg font-bold">{t.common.appName}</span>
          <nav aria-label={t.common.nav.label} className="flex flex-1 items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                data-testid={`nav-${item.id}`}
                className={({ isActive }) => `${linkBase} px-3 py-1.5 ${linkState(isActive)}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {shortcutsButton}
        </header>
      ) : (
        <header
          data-testid="nav-compact"
          className="relative z-40 flex h-14 min-w-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
        >
          <span className="shrink-0 text-lg font-bold">{t.common.appName}</span>
          <span
            data-testid="nav-title"
            className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300"
          >
            {currentTitle(pathname)}
          </span>
          <IconButton
            label={t.common.nav.menu}
            data-testid="nav-menu-button"
            aria-expanded={menuOpen}
            aria-controls="nav-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </IconButton>
          {shortcutsButton}
          {menuOpen ? (
            <nav
              id="nav-menu"
              aria-label={t.common.nav.label}
              data-testid="nav-menu"
              className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={item.end}
                  data-testid={`nav-${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `${linkBase} flex min-h-10 items-center px-3 ${linkState(isActive)}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </header>
      )}
      <DbErrorBanner />
      <BackupBanner />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
      <ShortcutSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
