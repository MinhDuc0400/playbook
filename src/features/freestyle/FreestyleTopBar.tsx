/** Freestyle top bar (FR-FS-01, FR-FS-03): title, side switch, undo/redo, clear, run placeholder. */
import { useState } from 'react';
import { useStore } from 'zustand';
import { t } from '@/i18n/vi';
import type { Side } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { emptyPlay } from './trayOps';

const btn =
  'inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';

export interface FreestyleTopBarProps {
  /** Trial view is showing (FR-FS-05): editing controls are disabled, `fs-edit` replaces `fs-run`. */
  trial?: boolean;
  /** Why Chạy thử is disabled (shown under the bar); null when it can run. */
  hint?: string | null;
  onRun?: () => void;
  onEdit?: () => void;
}

export function FreestyleTopBar({
  trial = false,
  hint = null,
  onRun,
  onEdit,
}: FreestyleTopBarProps = {}): JSX.Element {
  const side = useEditorStore((s) => s.play?.side ?? 'offense');
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);
  const [confirming, setConfirming] = useState(false);

  const choose = (target: Side): void => {
    if (useEditorStore.getState().play?.side !== target) useEditorStore.getState().switchSide();
  };

  const onClear = (): void => {
    const { play, companion } = useEditorStore.getState();
    const any = (play?.players.length ?? 0) + (companion?.players.length ?? 0) > 0;
    if (any && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    clearBoard();
  };

  const sides: { id: Side; label: string }[] = [
    { id: 'offense', label: t.freestyle.sideOffense },
    { id: 'defense', label: t.freestyle.sideDefense },
  ];

  return (
    <>
      <div
        role="toolbar"
        aria-label={t.freestyle.topBarLabel}
        data-testid="fs-topbar"
        className="flex min-w-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
      >
        <h1 className="mr-1 text-base font-bold">{t.freestyle.title}</h1>
        <div
          role="group"
          aria-label={t.freestyle.sideLabel}
          className="inline-flex overflow-hidden rounded-md"
        >
          {sides.map((s) => (
            <button
              key={s.id}
              type="button"
              data-testid={`fs-side-${s.id}`}
              aria-pressed={side === s.id}
              disabled={trial}
              onClick={() => choose(s.id)}
              className={`min-h-[40px] min-w-[40px] px-3 text-sm font-medium ${
                side === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="fs-undo"
          className={btn}
          disabled={trial || !canUndo}
          aria-label={t.editor.topBar.undo}
          title={t.editor.topBar.undo}
          onClick={() => useEditorStore.getState().undo()}
        >
          ↶
        </button>
        <button
          type="button"
          data-testid="fs-redo"
          className={btn}
          disabled={trial || !canRedo}
          aria-label={t.editor.topBar.redo}
          title={t.editor.topBar.redo}
          onClick={() => useEditorStore.getState().redo()}
        >
          ↷
        </button>
        <button
          type="button"
          data-testid="fs-clear"
          className={btn}
          disabled={trial}
          title={t.freestyle.clearTitle}
          onClick={onClear}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? t.freestyle.clearConfirm : t.freestyle.clear}
        </button>
        {trial ? (
          <button
            type="button"
            data-testid="fs-edit"
            className={`${btn} ml-auto`}
            title={t.freestyle.editTitle}
            onClick={onEdit}
          >
            {t.freestyle.edit}
          </button>
        ) : (
          <button
            type="button"
            data-testid="fs-run"
            className={`${btn} ml-auto`}
            disabled={hint !== null}
            title={hint ?? t.freestyle.runTitle}
            onClick={onRun}
          >
            {t.freestyle.run}
          </button>
        )}
      </div>
      {hint !== null && !trial && (
        <p
          data-testid="fs-hint"
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {hint}
        </p>
      )}
    </>
  );
}

/** Reset both sides to blank boards (keeps the active side). */
export function clearBoard(): void {
  const s = useEditorStore.getState();
  const active = s.play?.side ?? 'offense';
  s.loadPair(emptyPlay('offense'), emptyPlay('defense'), active);
}
