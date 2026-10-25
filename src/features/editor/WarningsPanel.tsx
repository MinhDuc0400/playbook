/** Warnings panel (FR-ED-07): informational only, never blocks saving. */
import { useMemo } from 'react';
import { DEFAULT_BALL_SPOT } from '@/domain/field';
import { defaultGhostFormation, getFormation } from '@/domain/formations';
import type { AlignedPlayer } from '@/domain/numbering';
import type { BallSpot, FieldConfig, Play } from '@/domain/types';
import { validatePlay, type PlayWarning } from '@/domain/validate';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';

export interface WarningsPanelProps {
  field: FieldConfig;
  ballSpot?: BallSpot;
}

function ghostPlayers(format: Play['format'], ghostFormationId: string | null): AlignedPlayer[] {
  const preset =
    (ghostFormationId === null ? undefined : getFormation(ghostFormationId)) ?? defaultGhostFormation(format);
  return preset.players.map((p) => ({ id: `ghost-${p.label}`, role: p.role, pos: p.start }));
}

function message(w: PlayWarning, play: Play, field: FieldConfig): string {
  const slot = play.players.find((s) => s.id === w.slotId)?.label ?? '?';
  const values: Record<string, string | number> = { ...w.params, slot, rushLine: field.rushLine };
  return t.editor.warnings.messages[w.code].replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

export function WarningsPanel({
  field,
  ballSpot = DEFAULT_BALL_SPOT,
}: WarningsPanelProps): JSX.Element | null {
  const play = useEditorStore((s) => s.play);
  const ghostFormationId = useEditorStore((s) => s.ghostFormationId);
  const select = useEditorStore((s) => s.select);

  const warnings = useMemo(
    () =>
      play
        ? validatePlay(play, field, {
            ballSpot,
            ghost: play.side === 'defense' ? ghostPlayers(play.format, ghostFormationId) : undefined,
          })
        : [],
    [play, field, ballSpot, ghostFormationId],
  );

  if (!play) return null;

  return (
    <section
      aria-label={t.editor.warnings.title}
      data-testid="warnings-panel"
      className="max-h-32 overflow-y-auto border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="text-sm font-semibold">
        {t.editor.warnings.title}
        {warnings.length > 0 ? ` (${warnings.length})` : ''}
      </h2>
      {warnings.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.editor.warnings.none}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {warnings.map((w, i) => {
            const text = message(w, play, field);
            const testId = `warning-${w.code}`;
            const cls = 'text-left text-sm text-amber-800 dark:text-amber-300';
            return (
              <li key={`${w.code}-${w.slotId ?? i}`}>
                {w.slotId !== undefined ? (
                  <button
                    type="button"
                    data-testid={testId}
                    className={`${cls} underline-offset-2 hover:underline`}
                    onClick={() => select([w.slotId as string])}
                  >
                    ⚠ {text}
                  </button>
                ) : (
                  <span data-testid={testId} className={cls}>
                    ⚠ {text}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
