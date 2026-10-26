import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import PlaybookPage from '../PlaybookPage';

const sel = vi.hoisted(() => ({ exportPlays: vi.fn(async (ids: readonly string[]) => ({ ids })) }));
vi.mock('@/lib/export/selective', () => ({ exportPlays: sel.exportPlays }));
vi.mock('@/lib/io/exportData', () => ({
  serializeExport: () => ({ json: '{}', fileName: 'flagbook-2026-01-01.json' }),
}));

vi.mock('../PlayCard', () => ({
  PlayCard: ({ play }: { play: { id: string } }) => <div data-testid={`card-${play.id}`} />,
}));
vi.mock('../MatchupList', () => ({
  MatchupList: () => <div data-testid="matchup-list" />,
}));

function Where(): JSX.Element {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/" element={<PlaybookPage />} />
        <Route path="/play/new" element={<p data-testid="new">new</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const cards = () => screen.queryAllByTestId(/^card-/).map((e) => e.dataset.testid);

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const p of createSamplePlays(1000)) await playsRepo.put(p);
});

describe('PlaybookPage (FR-PB-01, FR-PB-02)', () => {
  it('shows a card for each seeded play', async () => {
    renderAt();
    await waitFor(() => expect(cards()).toHaveLength(6));
  });

  it('filters by side, tag and search', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(cards()).toHaveLength(6));

    await user.selectOptions(screen.getByTestId('filter-side'), 'defense');
    expect(cards()).toHaveLength(3);
    expect(cards()).toContain(`card-${SEED_IDS.cover1}`);

    await user.selectOptions(screen.getByTestId('filter-side'), '');
    await user.type(screen.getByTestId('filter-search'), 'mesh');
    expect(cards()).toEqual([`card-${SEED_IDS.mesh}`]);

    await user.clear(screen.getByTestId('filter-search'));
    await user.type(screen.getByTestId('filter-search'), 'zzzz');
    expect(screen.getByTestId('playbook-empty')).toBeInTheDocument();

    await user.clear(screen.getByTestId('filter-search'));
    const tagSelect = screen.getByTestId('filter-tag') as HTMLSelectElement;
    const tag = [...tagSelect.options].map((o) => o.value).find((v) => v !== '');
    expect(tag).toBeDefined();
    await user.selectOptions(tagSelect, tag!);
    expect(cards().length).toBeGreaterThan(0);
    expect(cards().length).toBeLessThan(6);
  });

  it('keeps filter state in the URL and restores it on mount', async () => {
    const user = userEvent.setup();
    const first = renderAt();
    await waitFor(() => expect(cards()).toHaveLength(6));
    await user.selectOptions(screen.getByTestId('filter-side'), 'offense');
    expect(screen.getByTestId('where').textContent).toContain('side=offense');
    first.unmount();

    renderAt('/?side=offense&sort=name');
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(screen.getByTestId('filter-side')).toHaveValue('offense');
    expect(screen.getByTestId('filter-sort')).toHaveValue('name');
  });

  it('switches to the Matchup tab and has a new-play link', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(cards()).toHaveLength(6));
    expect(screen.getByTestId('btn-new-play')).toHaveAttribute('href', '/play/new');
    await user.click(screen.getByTestId('tab-matchups'));
    expect(screen.getByTestId('matchup-list')).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
    await user.click(screen.getByTestId('tab-plays'));
    await waitFor(() => expect(cards()).toHaveLength(6));
  });
});

describe('PlaybookPage select mode (FR-PB-06)', () => {
  it('exports the selected ids', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(cards()).toHaveLength(6));
    await user.click(screen.getByTestId('pb-select-mode'));
    await user.click(screen.getByTestId(`pb-select-${SEED_IDS.mesh}`));
    await user.click(screen.getByTestId(`pb-select-${SEED_IDS.smash}`));
    await user.click(screen.getByTestId('pb-export-selected'));
    await waitFor(() => expect(sel.exportPlays).toHaveBeenCalledTimes(1));
    expect([...sel.exportPlays.mock.calls[0]![0]].sort()).toEqual([SEED_IDS.mesh, SEED_IDS.smash].sort());
  });
});
