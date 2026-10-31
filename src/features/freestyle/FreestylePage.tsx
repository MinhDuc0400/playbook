/**
 * Freestyle page shell (FR-FS-01..03, FR-FS-16, D-27): blank two-sided board, no dialog, no formations.
 * Extension points: T13.4 trial run (FreestyleTopBar `fs-run`), T13.5 draft restore/save (mount effect).
 */
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/domain/types';
import { PanelTabs } from '@/components/ui/PanelTabs';
import { useSettings } from '@/db/hooks';
import { DEFAULT_BALL_SPOT } from '@/domain/field';
import type { Point, Role } from '@/domain/types';
import { DefensePanel } from '@/features/editor/defense/DefensePanel';
import { EditorCanvas } from '@/features/editor/EditorCanvas';
import { OffensePanel } from '@/features/editor/offense/OffensePanel';
import { Toolbar } from '@/features/editor/Toolbar';
import { useEditorShortcuts } from '@/features/editor/useEditorShortcuts';
import { t } from '@/i18n/vi';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { useEditorStore } from '@/store/editorStore';
import { FreestyleTopBar } from './FreestyleTopBar';
import { PlayerTray } from './PlayerTray';
import { TrialView } from './TrialView';
import { emptyPlay, placeRole } from './trayOps';
import { trialHint, useTrialKeys, useTrialPlays } from './useFreestyleTrial';

function isBoardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return target === document.body || target.tagName === 'svg' || target.closest('svg') !== null;
}

/** Tab (outside inputs/buttons) toggles the active side. */
function useSideToggleKey(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (!isBoardTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      useEditorStore.getState().switchSide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

interface BoardProps {
  maxPlayers: number;
  snap: boolean;
  showGrid: boolean;
  field: Parameters<typeof EditorCanvas>[0]['field'];
  settings: Settings;
}

function Board({ maxPlayers, snap, showGrid, field, settings }: BoardProps): JSX.Element {
  const isDesktop = useIsDesktop();
  const [trial, setTrial] = useState(false);
  const plays = useTrialPlays();
  const hint = trialHint(plays);
  const onRun = useCallback(() => setTrial(true), []);
  const onEdit = useCallback(() => setTrial(false), []);
  useTrialKeys(trial, hint === null, onRun, onEdit);
  const topBar = <FreestyleTopBar trial={trial} hint={hint} onRun={onRun} onEdit={onEdit} />;
  const isOffense = useEditorStore((s) => s.play?.side !== 'defense');
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  const onPlace = useCallback(
    (role: Role, point: Point): void => {
      const store = useEditorStore.getState();
      const before = new Set(store.play?.players.map((p) => p.id));
      store.apply('place-role', placeRole(role, point, maxPlayers, nanoid));
      const added = useEditorStore.getState().play?.players.find((p) => !before.has(p.id));
      if (added) useEditorStore.getState().select([added.id]);
    },
    [maxPlayers],
  );

  // Side switch drops any armed chip (its role may not exist on the other side).
  useEffect(() => setPendingRole(null), [isOffense]);

  const canvas = (
    <EditorCanvas
      field={field}
      ballSpot={DEFAULT_BALL_SPOT}
      snap={snap}
      showGrid={showGrid}
      pendingRole={pendingRole}
      onPlace={onPlace}
    />
  );
  const tray = (
    <PlayerTray maxPlayers={maxPlayers} pendingRole={pendingRole} onPendingRole={setPendingRole} />
  );
  const panel = isOffense ? <OffensePanel /> : <DefensePanel />;

  if (trial && plays.offense && plays.defense) {
    const view = <TrialView offense={plays.offense} defense={plays.defense} settings={settings} />;
    return isDesktop ? (
      <div data-testid="freestyle-page" className="flex h-[calc(100vh-3.5rem)] min-h-[480px] flex-col">
        {topBar}
        {view}
      </div>
    ) : (
      <div data-testid="freestyle-page" className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col">
        {topBar}
        {view}
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div data-testid="freestyle-page" className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col">
        {topBar}
        <Toolbar />
        <div
          data-testid="freestyle-field"
          className="h-[max(50dvh,320px)] min-w-0 shrink-0 overflow-hidden border-y border-slate-200 dark:border-slate-700"
        >
          {canvas}
        </div>
        <div className="min-w-0 p-2">{tray}</div>
        <PanelTabs
          className="min-w-0"
          tabs={[{ id: 'players', label: t.freestyle.panelsPlayers, content: panel }]}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="freestyle-page"
      className="grid h-[calc(100vh-3.5rem)] min-h-[480px] grid-cols-[auto_minmax(0,1fr)_20rem] grid-rows-[auto_minmax(0,1fr)]"
    >
      <div className="col-span-3">{topBar}</div>
      <aside className="border-r border-slate-200 dark:border-slate-700">
        <Toolbar />
      </aside>
      <div data-testid="freestyle-field" className="min-w-0 overflow-hidden">
        {canvas}
      </div>
      <aside className="flex min-w-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 p-2 dark:border-slate-700">
        <div className="shrink-0">{tray}</div>
        {panel}
      </aside>
    </div>
  );
}

export default function FreestylePage(): JSX.Element {
  const settings = useSettings();
  const [ready, setReady] = useState(false);
  const ppl = settings?.fields['5v5'].playersPerSide ?? 0;

  useEditorShortcuts(ppl);
  useSideToggleKey();

  const haveSettings = settings !== undefined;
  useEffect(() => {
    if (!haveSettings || ready) return;
    // T13.5 extension point: restore a saved draft here instead of a blank board.
    useEditorStore.getState().loadPair(emptyPlay('offense'), emptyPlay('defense'), 'offense');
    setReady(true);
  }, [haveSettings, ready]);

  if (!settings || !ready) return <div className="p-6">{t.common.loading}</div>;
  return (
    <Board
      field={settings.fields['5v5']}
      maxPlayers={settings.fields['5v5'].playersPerSide}
      snap={settings.ui.snap}
      showGrid={settings.ui.showGrid}
      settings={settings}
    />
  );
}
