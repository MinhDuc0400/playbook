import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { setFeatureOverride } from '@/config/features';
import { getDb } from '@/db/schema';
import { settingsRepo } from '@/db/repos/settings';
import { createDefaultSettings } from '@/domain/defaults';
import { t } from '@/i18n/vi';
import { FeatureGuard } from '../router';

function ui(): JSX.Element {
  return (
    <MemoryRouter initialEntries={['/suggest']}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route
          path="/suggest"
          element={
            <FeatureGuard flag="showSuggest">
              <div>suggest</div>
            </FeatureGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('T-FS-08 FeatureGuard waits for settings', () => {
  beforeEach(async () => {
    setFeatureOverride(null);
    await getDb().settings.clear();
  });

  it('does not redirect while settings load, redirects after load when advanced=false', async () => {
    render(ui());
    // First render: the live query has not resolved, so neither redirect nor children.
    expect(screen.queryByText('home')).toBeNull();
    expect(screen.queryByText('suggest')).toBeNull();
    expect(screen.getByText(t.common.loading)).toBeInTheDocument();
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(screen.queryByText('suggest')).toBeNull();
  });

  it('renders children after load when advanced=true', async () => {
    await settingsRepo.put({
      ...createDefaultSettings(),
      ui: { ...createDefaultSettings().ui, advanced: true },
    });
    render(ui());
    expect(screen.queryByText('home')).toBeNull();
    expect(await screen.findByText('suggest')).toBeInTheDocument();
    expect(screen.queryByText('home')).toBeNull();
  });
});
