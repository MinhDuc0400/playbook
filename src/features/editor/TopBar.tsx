/** Editor top bar (SRS §12.1): back, name, side/format badges, save status, Flip, preview, undo/redo, duplicate. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from 'zustand';
import { ExportPngButton } from '@/components/ExportPngButton';
import { Button, IconButton } from '@/components/ui';
import { playsRepo } from '@/db/repos/plays';
import { t } from '@/i18n/vi';
import { flip, setMeta } from '@/features/editor/ops';
import type { AutoSave } from '@/lib/useAutoSave';
import { useEditorStore } from '@/store/editorStore';

export interface TopBarProps {
  autosave: AutoSave;
}

const badge =
  'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200';

/** The field SVG's wrapper (the stage container), falling back to the SVG itself. */
function getFieldNode(): HTMLElement | null {
  const svg = document.querySelector<SVGElement>('[data-testid="field-svg"]');
  return (svg?.parentElement as HTMLElement | null) ?? (svg as unknown as HTMLElement | null);
}

export function TopBar({ autosave }: TopBarProps): JSX.Element | null {
  const navigate = useNavigate();
  const play = useEditorStore((s) => s.play);
  const previewing = useEditorStore((s) => s.previewing);
  const apply = useEditorStore((s) => s.apply);
  const setPreviewing = useEditorStore((s) => s.setPreviewing);
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);
  const [duplicating, setDuplicating] = useState(false);

  if (!play) return null;

  const duplicate = async (): Promise<void> => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      await autosave.flush();
      const copy = await playsRepo.duplicate(play.id);
      navigate(`/play/${copy.id}`);
    } catch {
      // Storage failures are surfaced by the DbErrorBanner.
      setDuplicating(false);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label={t.editor.topBar.label}
      className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
    >
      <Link
        to="/"
        data-testid="back-to-playbook"
        className="rounded-md px-2 py-1 text-sm font-medium text-blue-700 hover:bg-slate-100 dark:text-blue-300 dark:hover:bg-slate-700"
      >
        ← {t.editor.backToPlaybook}
      </Link>
      <input
        data-testid="play-name"
        aria-label={t.editor.topBar.name}
        placeholder={t.editor.topBar.namePlaceholder}
        value={play.name}
        onChange={(e) => apply('rename', setMeta({ name: e.target.value }))}
        className="min-w-48 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      <span data-testid="play-side" className={badge}>
        {t.editor.sides[play.side]}
      </span>
      <span data-testid="play-format" className={badge}>
        {t.editor.formats[play.format]}
      </span>
      <span data-testid="save-status" role="status" className="text-sm text-slate-600 dark:text-slate-300">
        {t.common.saveStatus[autosave.status]}
      </span>
      <Button
        data-testid="btn-flip"
        aria-label={t.editor.topBar.flipTitle}
        title={t.editor.topBar.flipTitle}
        onClick={() => apply('flip', flip())}
      >
        {t.editor.topBar.flip}
      </Button>
      {play.side === 'offense' ? (
        <Button
          data-testid="btn-preview"
          variant={previewing ? 'primary' : 'secondary'}
          aria-pressed={previewing}
          onClick={() => setPreviewing(!previewing)}
        >
          {previewing ? t.editor.topBar.previewClose : t.editor.topBar.preview}
        </Button>
      ) : null}
      <IconButton
        data-testid="btn-undo"
        label={t.editor.topBar.undo}
        disabled={!canUndo}
        onClick={() => useEditorStore.getState().undo()}
      >
        ↶
      </IconButton>
      <IconButton
        data-testid="btn-redo"
        label={t.editor.topBar.redo}
        disabled={!canRedo}
        onClick={() => useEditorStore.getState().redo()}
      >
        ↷
      </IconButton>
      <ExportPngButton getNode={getFieldNode} fileName={`${play.name || 'play'}.png`} />
      <Button data-testid="btn-duplicate" disabled={duplicating} onClick={() => void duplicate()}>
        {t.editor.topBar.duplicate}
      </Button>
    </div>
  );
}
