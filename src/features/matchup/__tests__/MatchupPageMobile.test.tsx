import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { t } from '@/i18n/vi';
import { useMatchupStore } from '@/store/matchupStore';
import { createMatchup } from '../buildSimInput';
import MatchupPage from '../MatchupPage';

vi.mock('../MatchupField', () => ({
  MatchupField: () => <div data-testid="mock-field" />,
}));

function stubPhone(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, // (min-width: 1024px) is false
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
}

beforeEach(async () => {
  stubPhone();
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of createSamplePlays(1)) await playsRepo.put(p);
  await matchupsRepo.put(
    createMatchup({
      offensePlayId: SEED_IDS.mesh,
      defensePlayId: SEED_IDS.cover1,
      now: 1000,
      idGen: () => 'mu1',
      seed: 5,
    }),
  );
  useMatchupStore.getState().reset();
});
afterEach(() => vi.unstubAllGlobals());

function renderMobile() {
  return render(
    <MemoryRouter initialEntries={['/matchup/mu1']}>
      <Routes>
        <Route path="/matchup/:id" element={<MatchupPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MatchupPage on phones (D-25)', () => {
  it('puts the field before the panel tabs and lists the five tabs', async () => {
    renderMobile();
    const page = await screen.findByTestId('matchup-page');
    expect(page).toHaveAttribute('data-layout', 'mobile');
    const field = await screen.findByTestId('matchup-field-area');
    const tabs = screen.getByTestId('panel-tabs');
    expect(field.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const labels = within(tabs)
      .getAllByRole('tab')
      .map((b) => b.textContent);
    expect(labels).toEqual([
      t.matchup.tabs.result,
      t.matchup.tabs.params,
      t.matchup.tabs.players,
      t.matchup.tabs.runMany,
      t.matchup.tabs.notes,
    ]);
    expect(screen.getByTestId('matchup-name')).toBeInTheDocument();
  });

  it('collapses the read timeline by default and the toggle still works', async () => {
    renderMobile();
    const toggle = await screen.findByTestId('read-timeline-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('read-timeline-scroll')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('read-timeline-scroll')).toBeInTheDocument();
  });

  it('shows the QB panel directly under the field, above the tabs', async () => {
    renderMobile();
    fireEvent.click(await screen.findByTestId('qb-mode-toggle'));
    const panel = await screen.findByTestId('qb-mode-panel');
    const tabs = screen.getByTestId('panel-tabs');
    const field = screen.getByTestId('matchup-field-area');
    expect(field.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the overlay sheet from the compact button and keeps notes plus add-to-install in the notes tab', async () => {
    renderMobile();
    fireEvent.click(await screen.findByTestId('overlay-menu'));
    expect(screen.getByTestId('overlay-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-toggle-trails')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('panel-tabs-tab-notes'));
    expect(screen.getByTestId('matchup-notes')).toBeInTheDocument();
  });
});
