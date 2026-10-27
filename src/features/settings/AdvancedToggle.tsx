/** Simple/Advanced mode switch (D-26). Writes Settings.ui.advanced; the nav and routes react immediately. */
import { useEffect, useState } from 'react';
import { settingsRepo } from '@/db/repos';
import { useSettings } from '@/db/hooks';
import { t } from '@/i18n/vi';

export function AdvancedToggle(): JSX.Element {
  const settings = useSettings();
  const stored = settings?.ui.advanced === true;
  // Optimistic: reflect the click at once, then follow the stored value (live query) once it catches up.
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => {
    if (pending !== null && stored === pending) setPending(null);
  }, [stored, pending]);
  const checked = pending ?? stored;
  const onChange = async (advanced: boolean): Promise<void> => {
    setPending(advanced);
    const latest = await settingsRepo.getOrDefault();
    await settingsRepo.update({ ui: { ...latest.ui, advanced } });
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="settings-advanced"
          checked={checked}
          onChange={(e) => void onChange(e.target.checked)}
        />
        {t.settings.advanced.toggle}
      </label>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t.settings.advanced.help}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t.settings.advanced.note}</p>
    </div>
  );
}
