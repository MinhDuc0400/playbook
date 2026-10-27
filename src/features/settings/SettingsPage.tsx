/** Settings screen (SRS §12.1). Sections render in order; Phase 5 appends field/tuning/preset/benchmark. */
import type { ReactNode } from 'react';
import { useFeatures } from '@/config/features';
import { Select } from '@/components/ui';
import { settingsRepo } from '@/db/repos';
import { useSettings } from '@/db/hooks';
import type { ThemePref } from '@/domain/types';
import { t } from '@/i18n/vi';
import { AdvancedToggle } from './AdvancedToggle';
import { BenchmarkSection } from './BenchmarkSection';
import { DataSection } from './DataSection';
import { FieldSection } from './FieldSection';
import { PresetsSection } from './PresetsSection';
import { TuningSection } from './TuningSection';

function AppearanceSection(): JSX.Element {
  const settings = useSettings();
  const ui = settings?.ui ?? { theme: 'system' as ThemePref, snap: true, showGrid: true };
  const patch = (next: Partial<typeof ui>): void => {
    void settingsRepo.update({ ui: { ...ui, ...next } });
  };
  return (
    <div className="flex flex-col gap-3">
      <Select
        label={t.settings.appearance.theme}
        data-testid="settings-theme"
        value={ui.theme}
        onChange={(e) => patch({ theme: e.target.value as ThemePref })}
      >
        <option value="light">{t.settings.appearance.themeLight}</option>
        <option value="dark">{t.settings.appearance.themeDark}</option>
        <option value="system">{t.settings.appearance.themeSystem}</option>
      </Select>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="settings-snap"
          checked={ui.snap}
          onChange={(e) => patch({ snap: e.target.checked })}
        />
        {t.settings.appearance.snap}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="settings-grid"
          checked={ui.showGrid}
          onChange={(e) => patch({ showGrid: e.target.checked })}
        />
        {t.settings.appearance.grid}
      </label>
    </div>
  );
}

interface SectionDef {
  id: string;
  title: string;
  render: () => ReactNode;
}

const TUNING_SECTIONS: SectionDef[] = [
  { id: 'field', title: t.tuning.sections.field, render: () => <FieldSection /> },
  { id: 'presets', title: t.tuning.sections.presets, render: () => <PresetsSection /> },
  { id: 'tuning', title: t.tuning.sections.tuning, render: () => <TuningSection /> },
  { id: 'benchmark', title: t.tuning.sections.benchmark, render: () => <BenchmarkSection /> },
];

const BASE_SECTIONS: SectionDef[] = [
  { id: 'data', title: t.settings.sections.data, render: () => <DataSection /> },
  { id: 'appearance', title: t.settings.sections.appearance, render: () => <AppearanceSection /> },
  { id: 'advanced', title: t.settings.sections.advanced, render: () => <AdvancedToggle /> },
];

export default function SettingsPage(): JSX.Element {
  const { showTuningSettings } = useFeatures();
  const sections = showTuningSettings ? [...TUNING_SECTIONS, ...BASE_SECTIONS] : BASE_SECTIONS;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-6" data-testid="page-settings">
      <h1 className="text-xl font-semibold">{t.settings.title}</h1>
      {sections.map((s) => (
        <section key={s.id} data-testid={`settings-section-${s.id}`} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          {s.render()}
        </section>
      ))}
    </div>
  );
}
