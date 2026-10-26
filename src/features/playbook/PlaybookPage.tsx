/** Playbook home (FR-PB-01, FR-PB-02): filterable play grid + Matchup tab. Filter state lives in the URL. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Select, TextInput } from '@/components/ui';
import { useMatchupCountByPlay, usePlays, useSettings } from '@/db/hooks';
import type { Format, ID, Side } from '@/domain/types';
import { t } from '@/i18n/vi';
import { downloadBlob } from '@/lib/export/download';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { exportPlays } from '@/lib/export/selective';
import { serializeExport } from '@/lib/io/exportData';
import { facets, filterPlays, type PlayFilter } from './filterPlays';
import { MatchupList } from './MatchupList';
import { PlayCard } from './PlayCard';

const FORMATS: Format[] = ['5v5', '7v7', 'custom'];

export default function PlaybookPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const plays = usePlays();
  const settings = useSettings();
  const counts = useMatchupCountByPlay();
  const isDesktop = useIsDesktop();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const toggleSelected = (id: ID): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exportSelected = async (): Promise<void> => {
    const file = await exportPlays([...selected]);
    const { json, fileName } = serializeExport(file);
    downloadBlob(
      new Blob([json], { type: 'application/json' }),
      fileName.replace('flagbook-', 'flagbook-plays-'),
    );
  };

  const tab = params.get('tab') === 'matchups' ? 'matchups' : 'plays';
  const sideP = params.get('side');
  const formatP = params.get('format');
  const filter: PlayFilter = {
    side: sideP === 'offense' || sideP === 'defense' ? (sideP as Side) : undefined,
    format: FORMATS.find((f) => f === formatP),
    formation: params.get('formation') || undefined,
    tag: params.get('tag') || undefined,
    q: params.get('q') || undefined,
    sort: params.get('sort') === 'name' ? 'name' : 'updated',
  };

  const setParam = (key: string, value: string): void => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === '') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const allPlays = useMemo(() => plays ?? [], [plays]);
  const { formations, tags } = useMemo(() => facets(allPlays), [allPlays]);
  const visible = useMemo(
    () => filterPlays(allPlays, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPlays, filter.side, filter.format, filter.formation, filter.tag, filter.q, filter.sort],
  );

  if (!plays || !settings) return <p className="p-6">{t.common.loading}</p>;

  const tabClass = (active: boolean): string =>
    `inline-flex min-h-10 items-center rounded-md px-3 py-1.5 text-sm font-medium lg:min-h-0 ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100'
    }`;

  const filterGrid = (cols: string, withSearch: boolean): JSX.Element => (
    <div id="playbook-filters" className={`grid gap-3 ${cols}`}>
      <Select
        label={t.playbook.filter.side}
        data-testid="filter-side"
        value={filter.side ?? ''}
        onChange={(e) => setParam('side', e.target.value)}
      >
        <option value="">{t.playbook.filter.sideAll}</option>
        <option value="offense">{t.playbook.filter.sideOffense}</option>
        <option value="defense">{t.playbook.filter.sideDefense}</option>
      </Select>
      <Select
        label={t.playbook.filter.format}
        data-testid="filter-format"
        value={filter.format ?? ''}
        onChange={(e) => setParam('format', e.target.value)}
      >
        <option value="">{t.playbook.filter.formatAll}</option>
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </Select>
      <Select
        label={t.playbook.filter.formation}
        data-testid="filter-formation"
        value={filter.formation ?? ''}
        onChange={(e) => setParam('formation', e.target.value)}
      >
        <option value="">{t.playbook.filter.formationAll}</option>
        {formations.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </Select>
      <Select
        label={t.playbook.filter.tag}
        data-testid="filter-tag"
        value={filter.tag ?? ''}
        onChange={(e) => setParam('tag', e.target.value)}
      >
        <option value="">{t.playbook.filter.tagAll}</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </Select>
      {withSearch ? searchEl : null}
      <Select
        label={t.playbook.filter.sort}
        data-testid="filter-sort"
        value={filter.sort}
        onChange={(e) => setParam('sort', e.target.value === 'name' ? 'name' : '')}
      >
        <option value="updated">{t.playbook.filter.sortUpdated}</option>
        <option value="name">{t.playbook.filter.sortName}</option>
      </Select>
    </div>
  );

  const searchEl = (
    <TextInput
      label={t.playbook.filter.search}
      type="search"
      placeholder={t.playbook.filter.searchPlaceholder}
      data-testid="filter-search"
      value={params.get('q') ?? ''}
      onChange={(e) => setParam('q', e.target.value)}
    />
  );

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="playbook-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t.playbook.tabs.label} className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plays'}
            data-testid="tab-plays"
            className={tabClass(tab === 'plays')}
            onClick={() => setParam('tab', '')}
          >
            {t.playbook.tabs.plays}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'matchups'}
            data-testid="tab-matchups"
            className={tabClass(tab === 'matchups')}
            onClick={() => setParam('tab', 'matchups')}
          >
            {t.playbook.tabs.matchups}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'plays' ? (
            <Button
              data-testid="pb-select-mode"
              aria-pressed={selectMode}
              variant={selectMode ? 'primary' : 'secondary'}
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected(new Set());
              }}
            >
              {selectMode ? t.exportx.select.toggleOff : t.exportx.select.toggle}
            </Button>
          ) : null}
          {tab === 'plays' && selectMode ? (
            <Button
              data-testid="pb-export-selected"
              disabled={selected.size === 0}
              onClick={() => void exportSelected()}
            >
              {t.exportx.select.exportSelected} ({selected.size})
            </Button>
          ) : null}
          <Link
            to="/play/new"
            data-testid="btn-new-play"
            className="inline-flex min-h-10 items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 lg:min-h-0"
          >
            {t.playbook.newPlay}
          </Link>
        </div>
      </div>

      {tab === 'matchups' ? (
        <MatchupList plays={allPlays} settings={settings} />
      ) : (
        <>
          <div role="search" aria-label={t.playbook.filter.label} className="flex flex-col gap-3">
            {isDesktop ? (
              filterGrid('grid-cols-6', true)
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">{searchEl}</div>
                  <Button
                    data-testid="filter-toggle"
                    aria-expanded={filtersOpen}
                    aria-controls="playbook-filters"
                    onClick={() => setFiltersOpen((v) => !v)}
                  >
                    {t.playbook.filter.label}
                  </Button>
                </div>
                {filtersOpen ? filterGrid('grid-cols-1 sm:grid-cols-2 md:grid-cols-3', false) : null}
              </>
            )}
          </div>

          {visible.length === 0 ? (
            <p data-testid="playbook-empty" className="py-8 text-center text-slate-600 dark:text-slate-300">
              {allPlays.length === 0 ? t.playbook.emptyAll : t.playbook.empty}
            </p>
          ) : (
            <div
              data-testid="playbook-grid"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {visible.map((play) => (
                <div key={play.id} className="relative">
                  {selectMode ? (
                    <input
                      type="checkbox"
                      data-testid={`pb-select-${play.id}`}
                      aria-label={`${t.exportx.select.selectPlay}: ${play.name}`}
                      checked={selected.has(play.id)}
                      onChange={() => toggleSelected(play.id)}
                      className="absolute left-2 top-2 z-10 h-6 w-6"
                    />
                  ) : null}
                  <PlayCard
                    play={play}
                    field={settings.fields[play.format]}
                    matchupCount={counts?.[play.id] ?? 0}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
