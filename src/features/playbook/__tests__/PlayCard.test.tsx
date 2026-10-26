import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { makePlay } from '@/db/__tests__/fixtures';
import { installsRepo, matchupsRepo, playsRepo } from '@/db/repos';
import { createDefaultSettings } from '@/domain/defaults';
import { PlayCard } from '../PlayCard';

const field = createDefaultSettings().fields['5v5'];

function Where(): JSX.Element {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function renderCard(play = makePlay('p1', { tags: ['red zone'] }), count = 3) {
  return render(
    <MemoryRouter>
      <Where />
      <Routes>
        <Route path="/" element={<PlayCard play={play} field={field} matchupCount={count} />} />
        <Route path="*" element={null} />
      </Routes>
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
});

describe('PlayCard (FR-PB-01, FR-PB-03, FR-PB-05)', () => {
  it('shows thumbnail, link to the editor, tags and matchup count', () => {
    renderCard();
    expect(screen.getByTestId('play-thumb-p1')).toBeInTheDocument();
    expect(screen.getByTestId('card-open-p1')).toHaveAttribute('href', '/play/p1');
    expect(screen.getByTestId('card-mcount-p1')).toHaveTextContent('3');
    expect(screen.getByText('#red zone')).toBeInTheDocument();
  });

  it('duplicate stores a copy', async () => {
    const play = makePlay('p1');
    await playsRepo.put(play);
    renderCard(play);
    await userEvent.setup().click(screen.getByTestId('card-duplicate-p1'));
    await waitFor(async () => expect(await playsRepo.list()).toHaveLength(2));
    const names = (await playsRepo.list()).map((p) => p.name);
    expect(names).toContain(`${play.name} (bản sao)`);
  });

  it('create matchup passes the right query param per side', async () => {
    const user = userEvent.setup();
    const first = renderCard(makePlay('o1', { side: 'offense' }));
    await user.click(screen.getByTestId('card-matchup-o1'));
    expect(screen.getByTestId('where')).toHaveTextContent('/matchup/new?offense=o1');
    first.unmount();
    renderCard(makePlay('d1', { side: 'defense' }));
    await user.click(screen.getByTestId('card-matchup-d1'));
    expect(screen.getByTestId('where')).toHaveTextContent('/matchup/new?defense=d1');
  });

  it('delete opens the dialog', async () => {
    const play = makePlay('p1');
    await playsRepo.put(play);
    renderCard(play);
    await userEvent.setup().click(screen.getByTestId('card-delete-p1'));
    expect(await screen.findByTestId('delete-confirm')).toBeInTheDocument();
  });
});
