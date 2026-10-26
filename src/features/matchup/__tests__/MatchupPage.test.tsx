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
  MatchupField: (p: {
    built: { input: { seed: number } };
    result: { frames: { players: Record<string, { pos: { x: number; y: number } }> }[]; debug?: unknown };
    t: number;
    ballSpot: { yardLine: number };
  }) => (
    <div
      data-testid="mock-field"
      data-sig={JSON.stringify(p.result.frames[Math.min(10, p.result.frames.length - 1)]?.players)}
      data-debug={p.result.debug ? 'yes' : 'no'}
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

describe('MatchupPage: advanced (FR-MU-10, FR-MU-11, FR-MU-13, FR-MU-14)', () => {
  it('anticipation slider re-simulates and shows the Oracle label only above 0.5', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    expect(screen.queryByTestId('ctl-oracle-label')).toBeNull();
    fireEvent.change(screen.getByTestId('ctl-anticipation'), { target: { value: '0.8' } });
    expect(screen.getByTestId('ctl-oracle-label')).toHaveTextContent(t.matchup.controls.oracle);
    fireEvent.change(screen.getByTestId('ctl-anticipation'), { target: { value: '0.5' } });
    expect(screen.queryByTestId('ctl-oracle-label')).toBeNull();
    await waitFor(async () => expect((await matchupsRepo.get('mu1'))?.anticipation).toBe(0.5), {
      timeout: 3000,
    });
  });

  it('requests debug data only when the perception overlay is on, with a defender select', async () => {
    const user = userEvent.setup();
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-debug', 'no');
    expect(screen.queryByTestId('debug-defender')).toBeNull();
    await user.click(screen.getByTestId('overlay-toggle-perception'));
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-debug', 'yes');
    const select = screen.getByTestId('debug-defender');
    const opt = (select as HTMLSelectElement).options[1]!;
    await user.selectOptions(select, opt.value);
    expect(useMatchupStore.getState().debugDefenderId).toBe(opt.value);
    expect(useMatchupStore.getState().overlays.qbEyes).toBe(true);
  });

  it('edit links point to the offense and defense plays', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    expect(screen.getByTestId('edit-offense')).toHaveAttribute('href', `/play/${SEED_IDS.mesh}`);
    expect(screen.getByTestId('edit-defense')).toHaveAttribute('href', `/play/${SEED_IDS.cover1}`);
  });

  it('FR-MU-14 editing the defense play in the DB re-runs the sim', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    const before = screen.getByTestId('mock-field').getAttribute('data-sig');
    const cover1 = (await playsRepo.get(SEED_IDS.cover1))!;
    const moved = {
      ...cover1,
      players: cover1.players.map((p, i) =>
        i === 0 ? { ...p, start: { x: p.start.x + 6, y: p.start.y + 4 } } : p,
      ),
    };
    await playsRepo.put(moved);
    await waitFor(() => expect(screen.getByTestId('mock-field').getAttribute('data-sig')).not.toBe(before));
  });

  it('shows the run-many panel', async () => {
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    expect(screen.getByTestId('run-many')).toHaveTextContent(t.matchup.runMany.run);
  });
});

describe('MatchupPage: random defense (FR-RD-01, FR-RD-02)', () => {
  it('rd-random swaps the defense in the DB, hides the name/edit link and reveals', async () => {
    const user = userEvent.setup();
    await seedMatchup();
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    await waitFor(() =>
      expect((screen.getByTestId('rd-tag') as HTMLSelectElement).options.length).toBeGreaterThan(1),
    );
    await user.selectOptions(screen.getByTestId('rd-tag'), 'cov:cover-3');
    await user.click(screen.getByTestId('rd-random'));
    expect(screen.queryByTestId('edit-defense')).toBeNull();
    expect(screen.getByTestId('defense-name-hidden')).toHaveTextContent(t.randomDef.hiddenName);
    expect(screen.getByTestId('rd-name')).toHaveTextContent(t.randomDef.hiddenName);
    await waitFor(async () => expect((await matchupsRepo.get('mu1'))?.defensePlayId).toBe(SEED_IDS.cover3), {
      timeout: 3000,
    });
    await user.click(screen.getByTestId('rd-reveal'));
    expect(screen.getByTestId('edit-defense')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('edit-defense')).toHaveAttribute('href', `/play/${SEED_IDS.cover3}`),
    );
  });
});
