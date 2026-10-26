/** Left toolbar: one IconButton per TOOLBAR[side] tool (aria-label, shortcut in title, aria-pressed). */
import { Button, IconButton } from '@/components/ui';
import { t } from '@/i18n/vi';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { useEditorStore } from '@/store/editorStore';
import { TOOLBAR, TOOLS } from './tools';
import type { ToolId } from './tools/types';

/** Shortcuts of tools not registered yet (phase 2+), shown in the tooltip. */
const FALLBACK_KEYS: Partial<Record<ToolId, string>> = {
  man: 'M',
  zone: 'Z',
  rush: 'B',
  motion: 'M',
};

const ICON_PATHS: Record<ToolId, string> = {
  select: 'M4 3l12 7-5.5 1.5L8 17z',
  place: 'M10 4a3 3 0 100 6 3 3 0 000-6zM4 17c0-3.3 2.7-5 6-5s6 1.7 6 5',
  route: 'M3 16l5-6 4 3 5-8M14 5h3v3',
  man: 'M4 15L16 5M4 15l3-5M4 15l5 1',
  zone: 'M10 3c4 0 7 2.5 7 6s-3 7-7 7-7-3.5-7-7 3-6 7-6z',
  rush: 'M4 16L16 4M16 4h-5M16 4v5',
  motion: 'M3 14l3-4 3 4 3-4 3 4 2-3',
  option: 'M10 17V9M10 9L5 3M10 9l5-6',
};

function ToolIcon({ id }: { id: ToolId }): JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[id]} />
    </svg>
  );
}

/** Touch layouts have no keyboard: replay the key on window, where the canvas listens (D-25). */
function pressKey(key: 'Enter' | 'Escape' | 'Delete'): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

export function Toolbar(): JSX.Element {
  const isDesktop = useIsDesktop();
  const side = useEditorStore((s) => s.play?.side ?? 'offense');
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div
      role="toolbar"
      aria-orientation={isDesktop ? 'vertical' : 'horizontal'}
      aria-label={t.tools.toolbar}
      data-testid="toolbar"
      className={isDesktop ? 'flex flex-col gap-1 p-1' : 'flex items-center gap-1 overflow-x-auto p-1'}
    >
      {TOOLBAR[side].map((id) => {
        const name = t.tools[id];
        const key = (TOOLS[id]?.key ?? FALLBACK_KEYS[id])?.toUpperCase();
        const active = tool === id;
        return (
          <IconButton
            key={id}
            label={name}
            title={key ? `${name} (${key})` : name}
            data-testid={`tool-${id}`}
            aria-pressed={active}
            className={isDesktop ? '' : 'h-10 w-10 shrink-0'}
            variant={active ? 'primary' : 'ghost'}
            onClick={() => setTool(id)}
          >
            <ToolIcon id={id} />
          </IconButton>
        );
      })}
      {isDesktop ? null : (
        <div
          role="group"
          aria-label={t.editor.touch.actions}
          className="ml-auto flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2 dark:border-slate-700"
        >
          <Button data-testid="btn-tool-done" className="min-h-10" onClick={() => pressKey('Enter')}>
            {t.editor.touch.done}
          </Button>
          <Button data-testid="btn-tool-cancel" className="min-h-10" onClick={() => pressKey('Escape')}>
            {t.editor.touch.cancel}
          </Button>
          <Button
            data-testid="btn-delete-selection"
            variant="danger"
            className="min-h-10"
            onClick={() => pressKey('Delete')}
          >
            {t.editor.touch.delete}
          </Button>
        </div>
      )}
    </div>
  );
}
