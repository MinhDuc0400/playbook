import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSettings } from '@/db/__tests__/fixtures';
import { settingsRepo } from '@/db/repos';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import type { Play } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { buildSimInput, createMatchup } from '@/features/matchup/buildSimInput';
import { ResultSummary } from '@/features/matchup/ResultPanel';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import FreestylePage from '../FreestylePage';
import { trialHint, pickTrialPlays } from '../useFreestyleTrial';
import { trialMatchup, trialSnapshot } from '../TrialView';
import { emptyPlay } from '../trayOps';

vi.mock('@/db/errors', () => ({ onDbError: vi.fn(() => () => undefined) }));
vi.mock('@/app/BackupBanner', () => ({ BackupBanner: () => null }));

const sim = vi.hoisted(() => ({ fail: false }));
vi.mock('@/engine/simulate', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/engine/simulate')>();
  return {
    ...mod,
    simulate: (...args: Parameters<typeof mod.simulate>) => {
      if (sim.fail) throw new Error('boom');
      return mod.simulate(...args);
    },
  };
});

const store = () => useEditorStore.getState();
const seeds = (): { flood: Play; cover1: Play } => {
  const all = createSamplePlays(0);
  return {
    flood: all.find((p) => p.id === SEED_IDS.flood)!,
    cover1: all.find((p) => p.id === SEED_IDS.cover1)!,
  };
};

async function mount() {
  render(
    <MemoryRouter initialEntries={['/freestyle']}>
      <Routes>
        <Route path="/freestyle" element={<FreestylePage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('freestyle-page');
}
/** The page blanks the board on mount; load the plays afterwards, like drawing them. */
function loadSeeds(offense: Play, defense: Play) {
  act(() => store().loadPair(offense, defense, 'offense'));
}

beforeEach(async () => {
  sim.fail = false;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
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
  await settingsRepo.put(makeSettings());
  store().load(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('T-FS-05 trial parity with Simple Matchup', () => {
  it('builds the same SimInput and result as a Simple Matchup with defenseFlip none', () => {
    const { flood, cover1 } = seeds();
    const settings = makeSettings();
    const snap = trialSnapshot(settings);
    const ref = createMatchup({
      offensePlayId: flood.id,
      defensePlayId: cover1.id,
      now: 0,
      idGen: () => 'x',
    });
    ref.defenseFlip = 'none';
    ref.id = 'freestyle';
    const expected = buildSimInput(ref, flood, cover1, snap, true);
    expect(trialMatchup(flood, cover1)).toEqual(ref);
    const got = buildSimInput(trialMatchup(flood, cover1), flood, cover1, snap, true);
    expect(got.input).toEqual(expected.input);
    expect(simulate(got.input).frames).toEqual(simulate(expected.input).frames);
    expect(got.input.seed).toBe(1);
    expect(got.input.noise).toBe(false);
  });

  it('the page shows the summary of that same result and the open windows', async () => {
    const { flood, cover1 } = seeds();
    await mount();
    loadSeeds(flood, cover1);
    fireEvent.click(screen.getByTestId('fs-run'));
    const summary = await screen.findByTestId('result-summary');
    const snap = trialSnapshot(makeSettings());
    const m = trialMatchup(flood, cover1);
    const built = buildSimInput(m, flood, cover1, snap, true);
    cleanup();
    const { container } = render(<ResultSummary result={simulate(built.input)} offense={built.offense} />);
    expect(summary.textContent).toBe(container.textContent);
    expect(summary.textContent).not.toBe('');
  });
});

describe('T-FS-05 trial gating', () => {
  it('is disabled with a hint until the offense has a QB and the defense has players', async () => {
    await mount();
    expect(screen.getByTestId('fs-run')).toBeDisabled();
    expect(screen.getByTestId('fs-hint')).toHaveTextContent(t.freestyle.hintNoOffense);
    const { flood, cover1 } = seeds();
    const noQb = { ...flood, players: flood.players.filter((p) => p.role !== 'QB') };
    loadSeeds(noQb, cover1);
    await waitFor(() => expect(screen.getByTestId('fs-hint')).toHaveTextContent('Thêm QB để chạy thử'));
    expect(screen.getByTestId('fs-run')).toBeDisabled();
    loadSeeds(flood, emptyPlay('defense'));
    await waitFor(() => expect(screen.getByTestId('fs-hint')).toHaveTextContent(t.freestyle.hintNoDefense));
    loadSeeds(flood, cover1);
    await waitFor(() => expect(screen.getByTestId('fs-run')).toBeEnabled());
    expect(screen.queryByTestId('fs-hint')).toBeNull();
  });

  it('trialHint and pickTrialPlays use the side of each play, not which one is active', () => {
    const { flood, cover1 } = seeds();
    expect(pickTrialPlays(cover1, flood)).toEqual({ offense: flood, defense: cover1 });
    expect(trialHint({ offense: flood, defense: cover1 })).toBeNull();
  });
});

describe('T-FS-05 trial view', () => {
  it('run shows the field, open windows and summary; fs-edit returns with players intact', async () => {
    const { flood, cover1 } = seeds();
    await mount();
    loadSeeds(flood, cover1);
    fireEvent.click(screen.getByTestId('fs-run'));
    expect(await screen.findByTestId('open-windows')).toBeInTheDocument();
    expect(screen.getByTestId('freestyle-trial')).toBeInTheDocument();
    expect(screen.queryByTestId('fs-run')).toBeNull();
    fireEvent.click(screen.getByTestId('fs-edit'));
    expect(screen.queryByTestId('freestyle-trial')).toBeNull();
    expect(screen.getByTestId('fs-run')).toBeEnabled();
    expect(store().play?.players).toHaveLength(flood.players.length);
    expect(store().companion?.players).toHaveLength(cover1.players.length);
  });

  it('Space runs, Esc returns, typing in an input is ignored', async () => {
    const { flood, cover1 } = seeds();
    await mount();
    loadSeeds(flood, cover1);
    await waitFor(() => expect(screen.getByTestId('fs-run')).toBeEnabled());
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(await screen.findByTestId('freestyle-trial')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('freestyle-trial')).toBeNull();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('freestyle-trial')).toBeNull();
    input.remove();
  });

  it('editing then running again re-simulates the new plays', async () => {
    const { flood, cover1 } = seeds();
    await mount();
    loadSeeds(flood, cover1);
    fireEvent.click(screen.getByTestId('fs-run'));
    await screen.findByTestId('open-windows');
    const rowsBefore = screen.getAllByTestId(/^ow-row-/).length;
    fireEvent.click(screen.getByTestId('fs-edit'));
    const victim = flood.players.find((p) => p.role !== 'QB' && p.role !== 'C')!;
    act(() =>
      store().apply('remove', (p) => ({ ...p, players: p.players.filter((s) => s.id !== victim.id) })),
    );
    fireEvent.click(screen.getByTestId('fs-run'));
    await screen.findByTestId('open-windows');
    expect(screen.getAllByTestId(/^ow-row-/).length).toBe(rowsBefore - 1);
  });

  it('QB tự ném: the toggle shows the panel and a key throws', async () => {
    const { flood, cover1 } = seeds();
    await mount();
    loadSeeds(flood, cover1);
    fireEvent.click(screen.getByTestId('fs-run'));
    await screen.findByTestId('qb-mode-toggle');
    fireEvent.click(screen.getByTestId('qb-mode-toggle'));
    const panel = await screen.findByTestId('qb-mode-panel');
    expect(within(panel).getByTestId('qb-key-legend')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'q' });
    expect(await screen.findByTestId('qb-feedback-target')).toBeInTheDocument();
  });

  it('a sim error is shown inline and does not throw', async () => {
    const { flood, cover1 } = seeds();
    await mount();
    loadSeeds(flood, cover1);
    sim.fail = true;
    fireEvent.click(screen.getByTestId('fs-run'));
    const err = await screen.findByTestId('matchup-sim-error');
    expect(err).toHaveTextContent(`${t.matchup.simError}: boom`);
    expect(screen.getByTestId('fs-edit')).toBeInTheDocument();
  });
});
