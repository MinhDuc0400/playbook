import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { t } from '@/i18n/vi';
import { useMatchupStore } from '@/store/matchupStore';
import { createMatchup } from '../buildSimInput';
import MatchupPage from '../MatchupPage';

// MatchupField is built by another task (stub at test time): record what the page passes to it.
vi.mock('../MatchupField', () => ({
  MatchupField: (p: { built: { input: { seed: number } }; t: number; ballSpot: { yardLine: number } }) => (
    <div
      data-testid="mock-field"
      data-seed={p.built.input.seed}
      data-t={p.t}
      data-yardline={p.ballSpot.yardLine}
    />
  ),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p data-testid="home">home</p>} />
        <Route path="/matchup/new" element={<MatchupPage />} />
        <Route path="/matchup/:id" element={<MatchupPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function seedMatchup(id = 'mu1') {
  const m = createMatchup({
    offensePlayId: SEED_IDS.mesh,
    defensePlayId: SEED_IDS.cover1,
    now: 1000,
    idGen: () => id,
    seed: 5,
  });
  await matchupsRepo.put(m);
  return m;
}

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of createSamplePlays(1)) await playsRepo.put(p);
  useMatchupStore.getState().reset();
});

describe('MatchupPage: loading (FR-DAT-03)', () => {
  it('unknown id shows not found', async () => {
    renderAt('/matchup/nope');
    expect(await screen.findByTestId('matchup-not-found')).toBeInTheDocument();
    expect(screen.getByText(t.matchup.back)).toHaveAttribute('href', '/');
  });

  it('deleted defense play shows a missing-play state naming the defense', async () => {
    await seedMatchup();
    await playsRepo.remove(SEED_IDS.cover1);
    renderAt('/matchup/mu1');
    const box = await screen.findByTestId('matchup-missing-play');
    expect(box).toHaveTextContent(t.matchup.missingPlay.defense);
    expect(screen.queryByTestId('matchup-page')).toBeNull();
  });

  it('loads a matchup, simulates and shows the result and timeline markers', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    expect(await screen.findByTestId('matchup-page')).toBeInTheDocument();
    expect(screen.getByTestId('result-outcome')).toBeInTheDocument();
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-seed', '5');
    const types = screen.getAllByTestId('timeline-marker').map((m) => m.getAttribute('data-type'));
    expect(types).toContain('snap');
  });
});

describe('MatchupPage: controls re-simulate and keep the playhead (§9)', () => {
  it('changing seed / ball / flip / dice updates the sim, t is unchanged', async () => {
    const user = userEvent.setup();
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    const field = () => screen.getByTestId('mock-field');

    fireEvent.change(screen.getByTestId('timeline-scrubber'), { target: { value: '0.5' } });
    const t0 = field().getAttribute('data-t');
    expect(Number(t0)).toBeCloseTo(0.5, 1);

    fireEvent.change(screen.getByTestId('ctl-seed'), { target: { value: '9' } });
    expect(field()).toHaveAttribute('data-seed', '9');
    expect(field()).toHaveAttribute('data-t', t0!);

    fireEvent.change(screen.getByTestId('ctl-ball-yardline'), { target: { value: '30' } });
    expect(field()).toHaveAttribute('data-yardline', '30');

    await user.click(screen.getByTestId('ctl-offense-flipped'));
    await user.selectOptions(screen.getByTestId('ctl-defense-flip'), 'none');
    await user.click(screen.getByTestId('ctl-noise'));
    expect(screen.getByTestId('result-outcome')).toBeInTheDocument();
    expect(field()).toHaveAttribute('data-t', t0!);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await user.click(screen.getByTestId('ctl-seed-dice'));
    vi.restoreAllMocks();
    expect(field()).toHaveAttribute('data-seed', String(2 ** 30));
    expect(field()).toHaveAttribute('data-t', t0!);
  });
});

describe('MatchupPage: auto-save (FR-MU-08)', () => {
  it('persists name and notes after the debounce', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    fireEvent.change(screen.getByTestId('matchup-name'), { target: { value: 'Mesh vs C1' } });
    fireEvent.change(screen.getByTestId('matchup-notes'), { target: { value: 'watch the rub' } });
    expect(screen.getByTestId('matchup-save-status')).toHaveTextContent(t.common.saveStatus.dirty);
    await waitFor(
      async () => {
        const stored = await matchupsRepo.get('mu1');
        expect(stored?.name).toBe('Mesh vs C1');
        expect(stored?.notes).toBe('watch the rub');
      },
      { timeout: 3000 },
    );
    await waitFor(() =>
      expect(screen.getByTestId('matchup-save-status')).toHaveTextContent(t.common.saveStatus.saved),
    );
  });
});

describe('MatchupPage: shortcuts and overlays', () => {
  it('Space toggles play, ] speeds up, → jumps to the next marker, ignored in inputs', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    const speed1 = screen.getByTestId('btn-speed-1');
    expect(speed1).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: ']' });
    expect(screen.getByTestId('btn-speed-2')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(Number(screen.getByTestId('mock-field').getAttribute('data-t'))).toBeGreaterThan(0);

    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(screen.getByTestId('btn-play')).toHaveAccessibleName(t.playback.pause);
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(screen.getByTestId('btn-play')).toHaveAccessibleName(t.playback.play);

    fireEvent.keyDown(screen.getByTestId('matchup-notes'), { key: ' ' });
    expect(screen.getByTestId('btn-play')).toHaveAccessibleName(t.playback.play);
  });

  it('overlay checkboxes toggle the store flags', async () => {
    const user = userEvent.setup();
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    expect(useMatchupStore.getState().overlays.trails).toBe(false);
    await user.click(screen.getByTestId('overlay-toggle-trails'));
    expect(useMatchupStore.getState().overlays.trails).toBe(true);
    await user.click(screen.getByTestId('overlay-toggle-zones'));
    expect(useMatchupStore.getState().overlays.zones).toBe(false);
    expect(screen.getByTestId('overlay-toggle-zones')).not.toBeChecked();
  });
});
