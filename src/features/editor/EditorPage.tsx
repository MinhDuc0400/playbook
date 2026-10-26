/**
 * Editor screen (SRS §12.1): `/play/new` (new-play dialog) and `/play/:id` (load, edit, auto-save).
 * FR-ED-01, FR-ED-04, FR-ED-05, FR-ED-06, FR-ED-07, FR-DAT-04.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlay, useSettings } from '@/db/hooks';
import { playsRepo } from '@/db/repos/plays';
import { DEFAULT_BALL_SPOT } from '@/domain/field';
import type { FieldConfig, Settings } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useAutoSave } from '@/lib/useAutoSave';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { PanelTabs } from '@/components/ui/PanelTabs';
import { useEditorStore } from '@/store/editorStore';
import { DefensePanel } from './defense/DefensePanel';
import { EditorCanvas } from './EditorCanvas';
import { MetaPanel } from './MetaPanel';
import { NewPlayDialog } from './NewPlayDialog';
import { OffensePanel } from './offense/OffensePanel';
import { PreviewOverlay } from './offense/PreviewOverlay';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { useEditorShortcuts } from './useEditorShortcuts';
import { usePlayWarnings, WarningsPanel } from './WarningsPanel';

const frame = 'h-[calc(100vh-3.5rem)] min-h-[480px]';

function NewPlayEntry(): JSX.Element {
  const navigate = useNavigate();
  const settings = useSettings();
  if (!settings) return <div className="p-6">{t.editor.loading}</div>;
  return <NewPlayDialog open defaultFormat={settings.defaultFormat} onClose={() => navigate('/')} />;
}

function PlayEditor({ id }: { id: string }): JSX.Element {
  const play = usePlay(id);
  const settings = useSettings();
  const storePlay = useEditorStore((s) => s.play);
  const previewing = useEditorStore((s) => s.previewing);
  const setPreviewing = useEditorStore((s) => s.setPreviewing);

  // Load into the store once per id: later live-query updates come from our own auto-save.
  const loadedFor = useRef<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  useEffect(() => {
    if (play && play.id === id && loadedFor.current !== id) {
      loadedFor.current = id;
      useEditorStore.getState().load(play);
      setLoadedId(id);
    }
  }, [play, id]);

  // A play left in the store by an earlier visit must not be shown or saved before this load.
  const inStore = loadedId === id && storePlay?.id === id;
  // Arm auto-save one render after the load so the loaded play is the saved baseline (not re-saved).
  const [armedFor, setArmedFor] = useState<string | null>(null);
  useEffect(() => {
    if (inStore) setArmedFor(id);
  }, [inStore, id]);

  const autosave = useAutoSave(
    storePlay,
    async (p) => {
      if (p) await playsRepo.put({ ...p, updatedAt: Date.now() });
    },
    { enabled: inStore && armedFor === id },
  );

  const fieldForShortcuts = settings && storePlay ? settings.fields[storePlay.format] : undefined;
  useEditorShortcuts(fieldForShortcuts?.playersPerSide ?? 0);

  if (play === null) {
    return (
      <div className="flex flex-col items-start gap-3 p-6" data-testid="editor-not-found">
        <p>{t.editor.notFound}</p>
        <Link to="/" className="text-blue-700 underline dark:text-blue-300">
          {t.editor.backToPlaybook}
        </Link>
      </div>
    );
  }
  if (!inStore || !storePlay || !settings) return <div className="p-6">{t.editor.loading}</div>;

  return (
    <EditorLayout
      autosave={autosave}
      field={settings.fields[storePlay.format]}
      isOffense={storePlay.side === 'offense'}
      snap={settings.ui.snap}
      showGrid={settings.ui.showGrid}
      tuning={settings.tuning}
      previewing={previewing}
      onClosePreview={() => setPreviewing(false)}
    />
  );
}

interface EditorLayoutProps {
  autosave: ReturnType<typeof useAutoSave>;
  field: FieldConfig;
  isOffense: boolean;
  snap: boolean;
  showGrid: boolean;
  tuning: Settings['tuning'];
  previewing: boolean;
  onClosePreview: () => void;
}

function EditorLayout(props: EditorLayoutProps): JSX.Element {
  const { autosave, field, isOffense, previewing } = props;
  const isDesktop = useIsDesktop();
  const warnings = usePlayWarnings(field, DEFAULT_BALL_SPOT);

  const fieldNode =
    previewing && isOffense ? (
      <PreviewOverlay
        field={field}
        ballSpot={DEFAULT_BALL_SPOT}
        tuning={props.tuning}
        onClose={props.onClosePreview}
      />
    ) : (
      <EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap={props.snap} showGrid={props.showGrid} />
    );

  if (!isDesktop) {
    // Phones/tablets (D-25): one column, field first, panels in a tab strip below.
    return (
      <div data-testid="editor-page" className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col">
        <TopBar autosave={autosave} />
        <Toolbar />
        <div
          data-testid="editor-field"
          className="h-[max(50dvh,320px)] min-w-0 shrink-0 overflow-hidden border-y border-slate-200 dark:border-slate-700"
        >
          {fieldNode}
        </div>
        <PanelTabs
          className="min-w-0"
          tabs={[
            { id: 'play', label: t.editor.panels.play, content: <MetaPanel /> },
            {
              id: 'players',
              label: t.editor.panels.players,
              content: isOffense ? <OffensePanel /> : <DefensePanel />,
            },
            {
              id: 'warnings',
              label: `${t.editor.panels.warnings}${warnings.length > 0 ? ` (${warnings.length})` : ''}`,
              content: <WarningsPanel field={field} ballSpot={DEFAULT_BALL_SPOT} warnings={warnings} />,
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="editor-page"
      className={`grid ${frame} grid-cols-[auto_minmax(0,1fr)_20rem] grid-rows-[auto_minmax(0,1fr)_auto]`}
    >
      <div className="col-span-3">
        <TopBar autosave={autosave} />
      </div>
      <aside className="border-r border-slate-200 dark:border-slate-700">
        <Toolbar />
      </aside>
      <div className="min-w-0 overflow-hidden">{fieldNode}</div>
      <aside className="overflow-y-auto border-l border-slate-200 dark:border-slate-700">
        <MetaPanel />
        {isOffense ? <OffensePanel /> : <DefensePanel />}
      </aside>
      <div className="col-span-3">
        <WarningsPanel field={field} ballSpot={DEFAULT_BALL_SPOT} warnings={warnings} />
      </div>
    </div>
  );
}

export default function EditorPage(): JSX.Element {
  const { id } = useParams();
  if (id === undefined) return <NewPlayEntry />;
  return <PlayEditor key={id} id={id} />;
}
