import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import type { Play } from '@/domain/types';
import MatchupPage from '../MatchupPage';

function Where(): JSX.Element {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/" element={<p data-testid="home">home</p>} />
        <Route path="/matchup/new" element={<MatchupPage />} />
        <Route path="/matchup/:id" element={<p data-testid="matchup-route">m</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const optionValues = (testId: string): string[] =>
  within(screen.getByTestId(testId))
    .getAllByRole('option')
    .map((o) => (o as HTMLOptionElement).value)
    .filter((v) => v !== '');

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  const plays = createSamplePlays(1);
  const sevenDef: Play = {
    ...plays.find((p) => p.id === SEED_IDS.cover1)!,
    id: 'def-7v7',
    name: 'Cover 7',
    format: '7v7',
  };
  for (const p of [...plays, sevenDef]) await playsRepo.put(p);
});

describe('NewMatchupDialog (FR-MU-01)', () => {
  it('lists only same-format defenses after choosing an offense; create is disabled until both chosen', async () => {
    const user = userEvent.setup();
    renderAt('/matchup/new');
    const create = await screen.findByTestId('new-matchup-create');
    await waitFor(() => expect(optionValues('new-matchup-defense')).toContain('def-7v7'));
    expect(create).toBeDisabled();

    await user.selectOptions(screen.getByTestId('new-matchup-offense'), SEED_IDS.smash);
    const defs = optionValues('new-matchup-defense');
    expect(defs).toContain(SEED_IDS.cover2);
    expect(defs).not.toContain('def-7v7');
    expect(create).toBeDisabled();

    await user.selectOptions(screen.getByTestId('new-matchup-defense'), SEED_IDS.cover2);
    expect(create).toBeEnabled();
  });

  it('choosing a defense first limits the offense list to its format', async () => {
    const user = userEvent.setup();
    renderAt('/matchup/new');
    await waitFor(() => expect(optionValues('new-matchup-defense')).toContain('def-7v7'));
    await user.selectOptions(screen.getByTestId('new-matchup-defense'), 'def-7v7');
    expect(optionValues('new-matchup-offense')).toEqual([]);
  });

  it('create stores the matchup and navigates to it', async () => {
    const user = userEvent.setup();
    renderAt('/matchup/new');
    await waitFor(() => expect(optionValues('new-matchup-defense')).toContain(SEED_IDS.cover2));
    await user.selectOptions(screen.getByTestId('new-matchup-offense'), SEED_IDS.smash);
    await user.selectOptions(screen.getByTestId('new-matchup-defense'), SEED_IDS.cover2);
    await user.click(screen.getByTestId('new-matchup-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/matchup\/.+/));
    const id = screen.getByTestId('where').textContent!.replace('/matchup/', '');
    const stored = await matchupsRepo.get(id);
    expect(stored).toMatchObject({ offensePlayId: SEED_IDS.smash, defensePlayId: SEED_IDS.cover2, seed: 1 });
  });

  it('prefills from query params and cancel returns home', async () => {
    const user = userEvent.setup();
    renderAt(`/matchup/new?offense=${SEED_IDS.mesh}&defense=${SEED_IDS.cover3}`);
    await waitFor(() => expect(screen.getByTestId('new-matchup-offense')).toHaveValue(SEED_IDS.mesh));
    expect(screen.getByTestId('new-matchup-defense')).toHaveValue(SEED_IDS.cover3);
    expect(screen.getByTestId('new-matchup-create')).toBeEnabled();
    await user.click(screen.getByTestId('new-matchup-cancel'));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
