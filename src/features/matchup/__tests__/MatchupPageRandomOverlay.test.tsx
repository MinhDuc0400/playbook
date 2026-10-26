import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { useMatchupStore } from '@/store/matchupStore';
import { createMatchup } from '../buildSimInput';
import MatchupPage from '../MatchupPage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of createSamplePlays(1)) await playsRepo.put(p);
  useMatchupStore.getState().reset();
});

describe('FR-RD-02 real field while hidden', () => {
  it('has no man lines or zones in the DOM while hidden, and shows them after reveal', async () => {
    const user = userEvent.setup();
    await matchupsRepo.put(
      createMatchup({
        offensePlayId: SEED_IDS.mesh,
        defensePlayId: SEED_IDS.cover1,
        now: 1000,
        idGen: () => 'mu2',
        seed: 5,
      }),
    );
    render(
      <MemoryRouter initialEntries={['/matchup/mu2']}>
        <Routes>
          <Route path="/matchup/:id" element={<MatchupPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('matchup-page');
    await waitFor(() =>
      expect((screen.getByTestId('rd-tag') as HTMLSelectElement).options.length).toBeGreaterThan(1),
    );
    const man = () => document.querySelectorAll('[data-testid^="overlay-man-"]').length;
    await waitFor(() => expect(man()).toBeGreaterThan(0));
    await user.selectOptions(screen.getByTestId('rd-tag'), 'cov:cover-1');
    await user.click(screen.getByTestId('rd-random'));
    expect(man()).toBe(0);
    expect(document.querySelectorAll('[data-testid^="overlay-zone"]').length).toBe(0);
    await user.click(screen.getByTestId('rd-reveal'));
    await waitFor(() => expect(man()).toBeGreaterThan(0));
  });
});
