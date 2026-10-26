/** Roster screen: Athlete tab + Lineup tab (FR-ATH-04, FR-ATH-05). */
import { useState } from 'react';
import { t } from '@/i18n/vi';
import { AthletesTab } from './AthletesTab';
import { LineupsTab } from './LineupsTab';

type Tab = 'athletes' | 'lineups';

export default function RosterPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('athletes');
  const tabClass = (active: boolean): string =>
    `min-h-[44px] px-4 border-b-2 ${active ? 'border-blue-600 font-semibold' : 'border-transparent'}`;
  return (
    <div className="p-4" data-testid="roster-page">
      <h1 className="mb-2 text-xl font-semibold">{t.roster.title}</h1>
      <div role="tablist" aria-label={t.roster.tabsLabel} className="mb-4 flex gap-2 overflow-x-auto border-b">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'athletes'}
          data-testid="tab-athletes"
          className={tabClass(tab === 'athletes')}
          onClick={() => setTab('athletes')}
        >
          {t.roster.tabAthletes}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'lineups'}
          data-testid="tab-lineups"
          className={tabClass(tab === 'lineups')}
          onClick={() => setTab('lineups')}
        >
          {t.roster.tabLineups}
        </button>
      </div>
      <div role="tabpanel">{tab === 'athletes' ? <AthletesTab /> : <LineupsTab />}</div>
    </div>
  );
}
