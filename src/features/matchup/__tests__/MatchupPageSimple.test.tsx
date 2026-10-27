import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeatureOverride } from '@/config/features';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { createDefaultSettings } from '@/domain/defaults';
import type { DbSnapshot, Matchup, SimInput } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { t } from '@/i18n/vi';
import { useMatchupStore } from '@/store/matchupStore';
import { buildSimInput, createMatchup } from '../buildSimInput';
import MatchupPage from '../MatchupPage';
import { bestThrowTime } from '../bestThrow';

const inputs: SimInput[] = [];
vi.mock('../useMatchupSim', async (orig) => {
  const m = await orig<typeof import('../useMatchupSim')>();
  return {
    ...m,
    useMatchupSim: (...a: Parameters<typeof m.useMatchupSim>) => {
      const r = m.useMatchupSim(...a);
      if (r.built) inputs.push(r.built.input);
      return r;
    },
  };
});
vi.mock('../bestThrow', async (orig) => {
  const m = await orig<typeof import('../bestThrow')>();
  return { ...m, bestThrowTime: vi.fn(m.bestThrowTime) };
});

vi.mock('../MatchupField', () => ({
  MatchupField: (p: {
    result: { frames: { players: Record<string, { pos: { x: number; y: number } }> }[] };
    levels: Record<string, unknown>;
  }) => (
    <div
      data-testid="mock-field"
      data-sig={JSON.stringify(p.result.frames[Math.min(10, p.result.frames.length - 1)]?.players)}
      data-levels={Object.keys(p.levels).length}
    />
  ),
}));

const plays = createSamplePlays(1);
const mesh = plays.find((p) => p.id === SEED_IDS.mesh)!;
const cover1 = plays.find((p) => p.id === SEED_IDS.cover1)!;
const snap: DbSnapshot = { settings: createDefaultSettings(), lineups: {}, athletes: {} };

function base(over: Partial<Matchup> = {}): Matchup {
  return {
    ...createMatchup({ offensePlayId: mesh.id, defensePlayId: cover1.id, now: 1, idGen: () => 'mu1' }),
    ...over,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/matchup/:id" element={<MatchupPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  setFeatureOverride(false);
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of createSamplePlays(1)) await playsRepo.put(p);
  useMatchupStore.getState().reset();
});
afterEach(() => setFeatureOverride(null));

describe('Simple mode: forced sim input (D-26)', () => {
  it('weak overrides + noise + seed 7 give the same frames as a clean default matchup', () => {
    const custom = base({
      seed: 7,
      noise: true,
      anticipation: 0.9,
      overrides: [{ side: 'offense', label: 'X', preset: 'weak' }],
    });
    const a = buildSimInput(custom, mesh, cover1, snap, true);
    const b = buildSimInput(base(), mesh, cover1, snap, true);
    expect(a.input.seed).toBe(1);
    expect(a.input.noise).toBe(false);
    expect(a.input.anticipation).toBe(0.5);
    expect(a.input.qbControl).toBe('auto');
    expect(a.input.manualThrow).toBeUndefined();
    expect(simulate(a.input).frames).toEqual(simulate(b.input).frames);
    // Advanced still honours them.
    expect(buildSimInput(custom, mesh, cover1, snap).input.seed).toBe(7);
  });
});

describe('Simple mode: page', () => {
  it('shows only the essentials', async () => {
    await matchupsRepo.put(base());
    renderAt('/matchup/mu1');
    expect(await screen.findByTestId('matchup-page')).toBeInTheDocument();
    for (const id of [
      'ctl-offense-flipped',
      'ctl-defense-flip',
      'open-windows',
      'result-summary',
      'timeline-scrubber',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    for (const id of [
      'run-many',
      'qb-mode-panel',
      'ctl-seed',
      'ctl-noise',
      'ctl-anticipation',
      'ctl-ball-x',
      'ctl-ball-yardline',
      'ctl-lineup-offense',
      'ctl-lineup-defense',
      'rd-random',
      'read-timeline',
      'player-panel',
      'result-panel',
      'simple-custom-note',
      'overlay-toggle-perception',
      'overlay-toggle-qbEyes',
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.getByTestId('qb-mode-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-levels', '0');
    expect(screen.getByTestId('overlay-toggle-zones')).toBeInTheDocument();
  });

  it('shows the custom note for a matchup with overrides', async () => {
    await matchupsRepo.put(base({ overrides: [{ side: 'offense', label: 'X', preset: 'weak' }] }));
    renderAt('/matchup/mu1');
    expect(await screen.findByTestId('simple-custom-note')).toHaveTextContent(t.matchup.simpleCustomNote);
  });

  it('flip changes the frames', async () => {
    const user = userEvent.setup();
    await matchupsRepo.put(base());
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    const before = screen.getByTestId('mock-field').getAttribute('data-sig');
    await user.click(screen.getByTestId('ctl-offense-flipped'));
    expect(screen.getByTestId('mock-field').getAttribute('data-sig')).not.toBe(before);
  });
});

describe('Simple mode: QB throw controls (D-26, D-23)', () => {
  const lastInput = () => inputs[inputs.length - 1]!;
  const setT = (v: number) =>
    fireEvent.change(screen.getByTestId('timeline-scrubber'), { target: { value: String(v) } });

  async function enter() {
    inputs.length = 0;
    const user = userEvent.setup();
    await matchupsRepo.put(base({ seed: 9, noise: true, anticipation: 0.9 }));
    renderAt('/matchup/mu1');
    await screen.findByTestId('matchup-page');
    await user.click(screen.getByTestId('qb-mode-toggle'));
    return user;
  }

  it('toggle shows the panel, key legend and manual input with forced stats; read timeline stays hidden', async () => {
    await enter();
    expect(screen.getByTestId('qb-mode-panel')).toBeInTheDocument();
    expect(screen.getByTestId('qb-key-legend').querySelectorAll('kbd').length).toBeGreaterThanOrEqual(2);
    expect(lastInput().qbControl).toBe('manual');
    expect(lastInput().manualThrow).toBeUndefined();
    expect(lastInput().seed).toBe(1);
    expect(lastInput().noise).toBe(false);
    expect(lastInput().anticipation).toBe(0.5);
    expect(lastInput().offenseStats['mesh-q'] ?? Object.values(lastInput().offenseStats)[0]).toEqual(
      snap.settings.presets.avg,
    );
    expect(screen.queryByTestId('read-timeline')).toBeNull();
  });

  it('pressing W at a paused playhead throws to read #2 at that time', async () => {
    const user = await enter();
    await user.keyboard(' ');
    act(() => setT(1.4));
    await user.keyboard('w');
    const m = lastInput().manualThrow;
    expect(m).toBeDefined();
    expect(m!.t).toBeCloseTo(1.4, 1);
    const second = screen.getByTestId('qb-feedback-target').textContent;
    expect(second).toBeTruthy();
    expect(lastInput().qbControl).toBe('manual');
    expect(lastInput().seed).toBe(1);
  });

  it('pressing a key while the animation plays throws at the running playhead', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      await matchupsRepo.put(base());
      renderAt('/matchup/mu1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      fireEvent.click(await screen.findByTestId('qb-mode-toggle'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      fireEvent.keyDown(window, { key: 'q' });
      expect(lastInput().manualThrow).toBeDefined();
      expect(lastInput().manualThrow!.t).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('"open nhất" button sets manualThrow to bestThrowTime and restarts playback', async () => {
    const user = await enter();
    await user.keyboard(' ');
    act(() => setT(3));
    const btn = screen.getAllByTestId(/^qb-best-/).find((b) => b.tagName === 'BUTTON')!;
    await user.click(btn);
    const call = vi.mocked(bestThrowTime).mock.results.at(-1)!;
    const expected = call.value as { t: number; separation: number };
    expect(expected).not.toBeNull();
    expect(lastInput().manualThrow!.t).toBe(expected.t);
    expect(lastInput().manualThrow!.targetId).toBe(vi.mocked(bestThrowTime).mock.calls.at(-1)![0].targetId);
    expect(screen.getByTestId('qb-feedback-best-time')).toHaveTextContent(
      t.matchup.qb.bestTime(expected.t, expected.separation),
    );
    // Playback restarted from the start (the field's mock does not show t; the scrubber does).
    expect(Number((screen.getByTestId('timeline-scrubber') as HTMLInputElement).value)).toBeLessThan(3);
  });

  it('shows qb-best-none and does nothing when there is no valid time', async () => {
    const user = await enter();
    vi.mocked(bestThrowTime).mockReturnValueOnce(null);
    await user.click(screen.getAllByTestId(/^qb-best-/).find((b) => b.tagName === 'BUTTON')!);
    expect(screen.getByTestId('qb-best-none')).toHaveTextContent(t.matchup.qb.bestNone);
    expect(lastInput().manualThrow).toBeUndefined();
    expect(screen.queryByTestId('qb-feedback-best-time')).toBeNull();
  });
});
