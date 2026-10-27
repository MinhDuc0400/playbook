import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeatureOverride } from '@/config/features';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { createDefaultSettings } from '@/domain/defaults';
import type { DbSnapshot, Matchup } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { t } from '@/i18n/vi';
import { useMatchupStore } from '@/store/matchupStore';
import { buildSimInput, createMatchup } from '../buildSimInput';
import MatchupPage from '../MatchupPage';

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
      'qb-mode-toggle',
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
