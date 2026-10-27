/** Simple/Advanced mode switch (D-26). Writes Settings.ui.advanced; the nav and routes react immediately. */
import { settingsRepo } from '@/db/repos';
import { useSettings } from '@/db/hooks';
import { t } from '@/i18n/vi';

export function AdvancedToggle(): JSX.Element {
  const settings = useSettings();
  const checked = settings?.ui.advanced === true;
  const onChange = async (advanced: boolean): Promise<void> => {
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
