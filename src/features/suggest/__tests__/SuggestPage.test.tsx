import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import type { AggregateResult, SimInput } from '@/domain/types';
import { suggestSessionCache } from '../sessionCache';
import SuggestPage from '../SuggestPage';

const sim = vi.hoisted(() => ({
  runMany: vi.fn(),
  hang: false,
}));
vi.mock('@/workers/simClient', () => ({ runMany: sim.runMany }));

function agg(pComplete: number, receiver: string): AggregateResult {
  return {
    runs: 30,
    outcomes: {} as AggregateResult['outcomes'],
    pComplete,
    pSack: 0.03,
    pInt: 0.05,
    avgYards: 6.2,
    avgYardsPerCompletion: 8,
    avgTimeToThrow: 2,
    targetDistribution: { [receiver]: 1 },
    perTarget: { [receiver]: { throws: 10, completes: Math.round(pComplete * 10), avgSepAtThrow: 2.3 } },
    avgSeparationAtThrow: { [receiver]: 2.3 },
  };
}

function Where(): JSX.Element {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/suggest']}>
      <Where />
      <Routes>
        <Route path="/suggest" element={<SuggestPage />} />
        <Route path="/matchup/new" element={<p>new</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const rows = () => screen.queryAllByTestId(/^sg-row-/).map((e) => e.dataset.testid);

beforeEach(async () => {
  suggestSessionCache.clear();
  sim.runMany.mockReset();
  sim.hang = false;
  sim.runMany.mockImplementation((input: SimInput, _runs: number) => {
    if (sim.hang) {
      let reject!: (e: unknown) => void;
      const promise = new Promise<AggregateResult>((_, r) => (reject = r));
      return { promise, cancel: () => reject(new DOMException('Aborted', 'AbortError')) };
    }
    const first = input.offense.players.find((p) => p.actions.some((a) => a.type === 'route'));
    // Mesh is made clearly the best vs everything.
    const good = input.offense.id === SEED_IDS.mesh;
    return {
      promise: Promise.resolve(agg(good ? 1 : 0.2, first?.id ?? 'x')),
      cancel: () => undefined,
    };
  });
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const p of createSamplePlays(1000)) await playsRepo.put(p);
});

async function pickCover2(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByTestId('sg-play').querySelectorAll('option').length).toBeGreaterThan(1),
  );
  await user.selectOptions(screen.getByTestId('sg-play'), SEED_IDS.cover2);
}

describe('SuggestPage (FR-SG-01..04, FR-SG-06)', () => {
  it('tag tier lists Smash first for Cover 2, offense only, max 5', async () => {
    const user = userEvent.setup();
    renderPage();
    await pickCover2(user);
    await waitFor(() => expect(rows().length).toBe(3));
    expect(rows()[0]).toBe(`sg-row-${SEED_IDS.smash}`);
    expect(screen.getByTestId(`sg-reasons-${SEED_IDS.smash}`)).toHaveTextContent('Tag khớp: beats:cover-2');
    expect(screen.getByTestId(`sg-score-${SEED_IDS.smash}`).textContent).toMatch(/^\d+\.\d{2}$/);
    expect(sim.runMany).not.toHaveBeenCalled();
  });

  it('defense direction lists defenses for a chosen offense', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('sg-dir-defense'));
    await waitFor(() =>
      expect(screen.getByTestId('sg-play').querySelectorAll('option').length).toBeGreaterThan(1),
    );
    await user.selectOptions(screen.getByTestId('sg-play'), SEED_IDS.smash);
    await waitFor(() => expect(rows().length).toBe(3));
    expect(rows()).toContain(`sg-row-${SEED_IDS.cover2}`);
    expect(rows()).not.toContain(`sg-row-${SEED_IDS.mesh}`);
  });

  it('runs sim, re-ranks with sim + target reasons, then hits the cache', async () => {
    const user = userEvent.setup();
    renderPage();
    await pickCover2(user);
    await waitFor(() => expect(rows().length).toBe(3));
    await user.click(screen.getByTestId('sg-run-sim'));
    await waitFor(() => expect(sim.runMany).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(rows()[0]).toBe(`sg-row-${SEED_IDS.mesh}`));
    const reasons = screen.getByTestId(`sg-reasons-${SEED_IDS.mesh}`);
    expect(within(reasons).getByText(/Hoàn thành 100%, 6\.2 yd\/lần, sack 3%, INT 5%/)).toBeInTheDocument();
    expect(within(reasons).getByText(/mở trung bình 2\.3 yd lúc ném, hoàn thành 100%/)).toBeInTheDocument();

    await user.click(screen.getByTestId('sg-run-sim'));
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(screen.queryByTestId('sg-progress')).toBeNull());
    expect(sim.runMany).toHaveBeenCalledTimes(3);
  });

  it('cancel stops the run', async () => {
    sim.hang = true;
    const user = userEvent.setup();
    renderPage();
    await pickCover2(user);
    await waitFor(() => expect(rows().length).toBe(3));
    await user.click(screen.getByTestId('sg-run-sim'));
    expect(await screen.findByTestId('sg-progress')).toBeInTheDocument();
    await user.click(screen.getByTestId('sg-cancel'));
    await waitFor(() => expect(screen.queryByTestId('sg-progress')).toBeNull());
    expect(screen.getByTestId('sg-message')).toHaveTextContent('Đã hủy');
    expect(sim.runMany).toHaveBeenCalledTimes(1);
  });

  it('Tạo matchup navigates with both ids', async () => {
    const user = userEvent.setup();
    renderPage();
    await pickCover2(user);
    await waitFor(() => expect(rows().length).toBe(3));
    await user.click(screen.getByTestId(`sg-create-${SEED_IDS.smash}`));
    expect(screen.getByTestId('where')).toHaveTextContent(
      `/matchup/new?offense=${SEED_IDS.smash}&defense=${SEED_IDS.cover2}`,
    );
  });
});
