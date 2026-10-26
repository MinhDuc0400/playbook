import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n/vi';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal dialog: Esc / backdrop close, focus moves in on open and returns on close. */
export function Dialog({ open, onClose, title, children }: DialogProps): JSX.Element | null {
  const titleId = useId();
  const hasMM = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const wide = useMediaQuery('(min-width: 640px)');
  const sheet = hasMM && !wide; // full-screen sheet on phones (D-25)
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  // Keep Tab inside the dialog.
  const trapTab = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const firstEl = items[0]!;
    const lastEl = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return createPortal(
    <div
      data-testid="dialog-backdrop"
      className={`fixed inset-0 z-50 flex bg-black/50 ${sheet ? '' : 'items-center justify-center p-4'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-variant={sheet ? 'sheet' : 'modal'}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`w-full overflow-auto bg-white p-4 text-slate-900 shadow-xl dark:bg-slate-800 dark:text-slate-100 ${
          sheet ? 'h-dvh max-h-dvh' : 'max-h-[90vh] max-w-2xl rounded-lg'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton label={t.common.close} onClick={onClose}>
            ×
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
