/** Keyboard shortcut reference opened with "?" (SRS §12.3). */
import { Dialog } from '@/components/ui';
import { t } from '@/i18n/vi';

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const s = t.common.shortcuts;
  return (
    <Dialog open={open} onClose={onClose} title={s.title}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-600">
              <th className="py-1 pr-3">{s.colKeys}</th>
              <th className="py-1 pr-3">{s.colScope}</th>
              <th className="py-1">{s.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-1 pr-3">
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-mono dark:border-slate-600 dark:bg-slate-700">
                    {row.keys}
                  </kbd>
                </td>
                <td className="py-1 pr-3">{row.scope}</td>
                <td className="py-1">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
