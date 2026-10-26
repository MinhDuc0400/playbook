/**
 * Side panels on desktop, a tab strip on phones/tablets (D-25).
 * Desktop (≥ 1024 px): every panel rendered stacked. Smaller: tab buttons + the active panel only.
 */
import { useState, type ReactNode } from 'react';
import { useIsDesktop } from '@/lib/useMediaQuery';

export interface PanelTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface PanelTabsProps {
  tabs: readonly PanelTab[];
  /** Force a mode (tests); default follows the viewport. */
  mode?: 'stack' | 'tabs';
  className?: string;
  testId?: string;
}

export function PanelTabs({
  tabs,
  mode,
  className = '',
  testId = 'panel-tabs',
}: PanelTabsProps): JSX.Element {
  const isDesktop = useIsDesktop();
  const effective = mode ?? (isDesktop ? 'stack' : 'tabs');
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (effective === 'stack') {
    return (
      <div data-testid={testId} data-mode="stack" className={className}>
        {tabs.map((t) => (
          <div key={t.id}>{t.content}</div>
        ))}
      </div>
    );
  }
  return (
    <div data-testid={testId} data-mode="tabs" className={className}>
      <div
        role="tablist"
        className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current?.id}
            data-testid={`${testId}-tab-${t.id}`}
            onClick={() => setActive(t.id)}
            className={`min-h-10 shrink-0 rounded px-3 text-sm font-medium ${
              t.id === current?.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
