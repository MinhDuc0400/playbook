import type { DragEvent, JSX } from 'react';
import type { Role } from '@/domain/types';
import { removePlayers } from '@/features/editor/ops';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { remaining, TRAY_ROLES } from './trayOps';

export const ROLE_DRAG_TYPE = 'application/x-flagbook-role';

export interface PlayerTrayProps {
  maxPlayers: number;
  pendingRole: Role | null;
  onPendingRole: (role: Role | null) => void;
}

export function PlayerTray({ maxPlayers, pendingRole, onPendingRole }: PlayerTrayProps): JSX.Element | null {
  const play = useEditorStore((s) => s.play);
  const selection = useEditorStore((s) => s.selection);
  const apply = useEditorStore((s) => s.apply);
  if (!play) return null;
  const left = remaining(play, play.side, maxPlayers);

  const onDragStart = (e: DragEvent<HTMLButtonElement>, role: Role): void => {
    e.dataTransfer.setData(ROLE_DRAG_TYPE, role);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      role="toolbar"
      aria-label={t.freestyle.trayLabel}
      data-testid="player-tray"
      className="flex w-full max-w-full items-center gap-2 overflow-x-auto"
    >
      {TRAY_ROLES[play.side].map((role) => {
        const count = left[role];
        const armed = pendingRole === role;
        return (
          <button
            key={role}
            type="button"
            data-testid={`tray-chip-${role}`}
            disabled={count <= 0}
            draggable={count > 0}
            aria-pressed={armed}
            title={t.freestyle.chipHint}
            onDragStart={(e) => onDragStart(e, role)}
            onClick={() => onPendingRole(armed ? null : role)}
            className={`flex min-h-[40px] min-w-[40px] shrink-0 items-center gap-1 rounded-full border px-3 text-sm disabled:opacity-40 ${
              armed ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
            }`}
          >
            <span>{t.freestyle.roles[role]}</span>
            <span data-testid={`tray-count-${role}`} aria-label={t.freestyle.remaining}>
              {count}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        data-testid="tray-remove"
        disabled={selection.length === 0}
        onClick={() => apply(t.freestyle.removeSelected, removePlayers(selection))}
        className="min-h-[40px] shrink-0 rounded border border-slate-300 px-3 text-sm disabled:opacity-40"
      >
        {t.freestyle.removeSelected}
      </button>
    </div>
  );
}
