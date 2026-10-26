import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeInstall, makeMatchup, makePlay } from '@/db/__tests__/fixtures';
import { installsRepo, matchupsRepo, playsRepo } from '@/db/repos';
import { createDefaultSettings } from '@/domain/defaults';
import { MatchupList } from '../MatchupList';

const settings = createDefaultSettings();
const plays = [
  makePlay('o1'),
  makePlay('o2'),
  makePlay('d1', { side: 'defense' }),
  makePlay('d2', { side: 'defense' }),
];

function renderList(list = plays) {
  return render(
    <MemoryRouter>
      <MatchupList plays={list} settings={settings} />
    </MemoryRouter>,
  );
}

async function clearAll(): Promise<void> {
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const i of await installsRepo.list()) await installsRepo.remove(i.id);
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
}

beforeEach(async () => {
  await clearAll();
  await matchupsRepo.bulkPut([
    makeMatchup('m1', 'o1', 'd1', { name: 'Named' }),
    makeMatchup('m2', 'o2', 'd2'),
    makeMatchup('m3', 'o1', 'd2'),
  ]);
});

describe('MatchupList (FR-PB-04, FR-DAT-03)', () => {
  it('shows a row per matchup with links and two thumbnails', async () => {
    renderList();
    await waitFor(() => expect(screen.getAllByTestId(/^mrow-m\d$/)).toHaveLength(3));
    expect(screen.getByTestId('mrow-open-m1')).toHaveAttribute('href', '/matchup/m1');
    expect(screen.getByTestId('mrow-m1')).toHaveTextContent('Named');
    expect(screen.getByTestId('mrow-m2')).toHaveTextContent('Play o2 vs Play d2');
    const row = within(screen.getByTestId('mrow-m1'));
    expect(row.getByTestId('play-thumb-o1')).toBeInTheDocument();
    expect(row.getByTestId('play-thumb-d1')).toBeInTheDocument();
  });

  it('filters by offense and defense play', async () => {
    const user = userEvent.setup();
    renderList();
    await waitFor(() => expect(screen.getAllByTestId(/^mrow-m\d$/)).toHaveLength(3));
    await user.selectOptions(screen.getByTestId('mfilter-offense'), 'o1');
    expect(screen.getAllByTestId(/^mrow-m\d$/)).toHaveLength(2);
    await user.selectOptions(screen.getByTestId('mfilter-defense'), 'd2');
    expect(screen.getAllByTestId(/^mrow-m\d$/).map((e) => e.dataset.testid)).toEqual(['mrow-m3']);
  });

  it('shows an error label for a missing play without crashing', async () => {
    renderList(plays.filter((p) => p.id !== 'd1'));
    expect(await screen.findByTestId('mrow-missing-m1')).toBeInTheDocument();
    expect(screen.queryByTestId('mrow-missing-m2')).toBeNull();
  });

  it('delete removes the matchup and its install item', async () => {
    await installsRepo.put(makeInstall('iA', ['m1', 'm2']));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderList();
    await userEvent.setup().click(await screen.findByTestId('mrow-delete-m1'));
    await waitFor(() => expect(screen.queryByTestId('mrow-m1')).toBeNull());
    expect(await matchupsRepo.get('m1')).toBeUndefined();
    expect((await installsRepo.get('iA'))?.items.map((i) => i.matchupId)).toEqual(['m2']);
  });
});
