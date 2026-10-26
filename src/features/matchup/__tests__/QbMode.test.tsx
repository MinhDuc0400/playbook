import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import type { DbSnapshot, Matchup, Play, SimInput, SimResult } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { t } from '@/i18n/vi';
import { useMatchupStore } from '@/store/matchupStore';
import { buildSimInput, createMatchup } from '../buildSimInput';
import MatchupPage from '../MatchupPage';
import { buildQbKeyMap, qbFeedback } from '../useQbMode';

type Override = Pick<SimInput, 'qbControl' | 'manualThrow'> | undefined;
const simCalls: Override[] = [];
const fieldProps: { hideReadInfo?: boolean; qbKeys?: { key: string; label: string; id: string }[] }[] = [];
let outcomeKind: 'complete' | 'incomplete' = 'complete';

// The engine contract of D-23 is mocked: scores per receiver in read order (first = best), a decision of
// kind 'manual' when a throw is present.
vi.mock('../useMatchupSim', () => ({
  useMatchupSim: (m: Matchup, o: Play, d: Play, snap: DbSnapshot, _debug: boolean, override: Override) => {
    simCalls.push(override);
    const built0 = buildSimInput(m, o, d, snap);
    const built = override ? { ...built0, input: { ...built0.input, ...override } } : built0;
    const base = simulate(built0.input);
    const ids = built.offense.players.filter((p) => p.role !== 'QB').map((p) => p.id);
    const frames = base.frames.map((f) => ({
      ...f,
      qb: { scores: Object.fromEntries(ids.map((id, i) => [id, 90 - 20 * i])) },
    }));
    const result: SimResult = {
      ...base,
      frames,
      outcome: override?.manualThrow
        ? outcomeKind === 'complete'
          ? { kind: 'complete', targetId: override.manualThrow.targetId, t: 2.5, yards: 7 }
          : { kind: 'incomplete', targetId: override.manualThrow.targetId, t: 2.5 }
        : base.outcome,
      metrics: {
        ...base.metrics,
        separation: Object.fromEntries(ids.map((id, i) => [id, [{ t: -1, d: 1 + i }]])),
        reads: {
          mode: 'progression',
          windows: ids.map((id, i) => ({ id, index: i, from: 1, to: 2, auto: true })),
          decision: override?.manualThrow
            ? {
                kind: 'manual',
                t: override.manualThrow.t,
                targetId: override.manualThrow.targetId,
                readIndex: null,
              }
            : { kind: 'none', t: 4, readIndex: null },
        },
      },
    };
    return { built, result, error: null };
  },
}));

vi.mock('../MatchupField', () => ({
  MatchupField: (p: {
    hideReadInfo?: boolean;
    qbKeys?: { key: string; label: string; id: string }[];
    onQbPick?: (id: string) => void;
    t: number;
  }) => {
    fieldProps.push({ hideReadInfo: p.hideReadInfo, qbKeys: p.qbKeys });
    return (
      <div data-testid="mock-field" data-t={p.t} data-hide={String(!!p.hideReadInfo)}>
        {p.qbKeys?.map((k) => (
          <button key={k.key} data-testid={`mock-token-${k.label}`} onClick={() => p.onQbPick?.(k.id)}>
            {k.key}
          </button>
        ))}
      </div>
    );
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/matchup/mu1']}>
      <Routes>
        <Route path="/matchup/:id" element={<MatchupPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  simCalls.length = 0;
  fieldProps.length = 0;
  outcomeKind = 'complete';
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of createSamplePlays(1)) await playsRepo.put(p);
  await matchupsRepo.put(
    createMatchup({
      offensePlayId: SEED_IDS.mesh,
      defensePlayId: SEED_IDS.cover1,
      now: 1000,
      idGen: () => 'mu1',
      seed: 5,
    }),
  );
  useMatchupStore.getState().reset();
});
afterEach(cleanup);

const lastOverride = () => simCalls[simCalls.length - 1];
const setT = (v: number) =>
  fireEvent.change(screen.getByTestId('timeline-scrubber'), { target: { value: String(v) } });

async function enter() {
  const user = userEvent.setup();
  renderPage();
  await screen.findByTestId('matchup-page');
  await user.click(screen.getByTestId('qb-mode-toggle'));
  return user;
}

describe('QB mode (D-23)', () => {
  it('toggle switches the sim input to manual, shows the key legend and restores auto on exit', async () => {
    const user = await enter();
    expect(lastOverride()).toEqual({ qbControl: 'manual' });
    const keys = screen.getByTestId('qb-key-legend').querySelectorAll('kbd');
    expect([...keys].map((k) => k.textContent)).toEqual(['Q', 'W', 'E', 'R'].slice(0, keys.length));
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('qb-hint')).toHaveTextContent(t.matchup.qb.hint);
    expect(fieldProps[fieldProps.length - 1]!.qbKeys?.[0]?.key).toBe('Q');
    await user.click(screen.getByTestId('qb-exit'));
    expect(lastOverride()).toBeUndefined();
    expect(screen.queryByTestId('qb-mode-panel')).toBeNull();
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-hide', 'false');
  });

  it('hides separation and the score legend before the throw, reveals them after', async () => {
    const user = await enter();
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-hide', 'true');
    expect(screen.queryByTestId('read-scores')).toBeNull();
    expect(screen.queryByTestId('result-panel')).toBeNull();
    await user.keyboard('w');
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-hide', 'false');
    expect(screen.getByTestId('read-scores')).toBeInTheDocument();
    expect(screen.getByTestId('result-panel')).toBeInTheDocument();
  });

  it('pressing W throws to read #2 at the playhead, keeps t, shows feedback and ignores a second key', async () => {
    const user = await enter();
    await user.keyboard(' '); // pause (playback restarts and plays on entering the mode)
    act(() => setT(1.4));
    const tBefore = screen.getByTestId('mock-field').getAttribute('data-t');
    const second = fieldProps[fieldProps.length - 1]!.qbKeys![1]!;
    await user.keyboard('w');
    const o = lastOverride();
    expect(o?.qbControl).toBe('manual');
    expect(o?.manualThrow?.targetId).toBe(second.id);
    expect(o?.manualThrow?.t).toBeCloseTo(1.4, 1);
    expect(screen.getByTestId('mock-field')).toHaveAttribute('data-t', tBefore!);
    expect(screen.getByTestId('qb-feedback-target')).toHaveTextContent(second.label);
    expect(screen.getByTestId('qb-feedback-time')).toHaveTextContent('1.4');
    expect(screen.getByTestId('qb-feedback-score')).toHaveTextContent('70');
    expect(screen.getByTestId('qb-feedback-sep')).toHaveTextContent('2.0');
    const first = fieldProps[fieldProps.length - 1]!.qbKeys![0]!;
    expect(screen.getByTestId('qb-feedback-best')).toHaveTextContent(t.matchup.qb.best(first.label, 90));
    // Ball not landed yet at t = 1.4 (outcome t = 2.5).
    expect(screen.getByTestId('qb-feedback-outcome')).toHaveTextContent(t.matchup.qb.inFlight);
    act(() => setT(3));
    expect(screen.getByTestId('qb-feedback-outcome')).toHaveTextContent(t.result.outcome.complete);

    const calls = simCalls.length;
    await user.keyboard('q');
    expect(lastOverride()?.manualThrow?.targetId).toBe(second.id);
    expect(simCalls.length).toBe(calls);
  });

  it('keys inside inputs are ignored; clicking a receiver token throws', async () => {
    const user = await enter();
    await user.type(screen.getByTestId('matchup-name'), 'w');
    expect(lastOverride()?.manualThrow).toBeUndefined();
    await user.click(
      screen.getByTestId('mock-token-' + fieldProps[fieldProps.length - 1]!.qbKeys![0]!.label),
    );
    expect(lastOverride()?.manualThrow?.targetId).toBe(fieldProps[fieldProps.length - 1]!.qbKeys![0]!.id);
    expect(screen.getByTestId('qb-feedback-best')).toHaveTextContent(t.matchup.qb.bestChosen);
  });

  it('tally counts attempts, completions and best-choice throws across retries; retry clears the throw', async () => {
    const user = await enter();
    expect(screen.getByTestId('qb-tally')).toHaveTextContent(t.matchup.qb.tallyEmpty);
    await user.keyboard('q'); // best, complete
    expect(screen.getByTestId('qb-tally')).toHaveTextContent(t.matchup.qb.tally(1, 1, 1));
    await user.click(screen.getByTestId('qb-retry'));
    expect(lastOverride()).toEqual({ qbControl: 'manual' });
    expect(screen.getByTestId('qb-hint')).toBeInTheDocument();
    outcomeKind = 'incomplete';
    await user.keyboard('e'); // not best, incomplete
    expect(screen.getByTestId('qb-tally')).toHaveTextContent(t.matchup.qb.tally(2, 1, 1));
    await user.click(screen.getByTestId('qb-retry'));
    await user.keyboard('q');
    expect(screen.getByTestId('qb-tally')).toHaveTextContent(t.matchup.qb.tally(3, 1, 2));
    expect(within(screen.getByTestId('qb-mode-panel')).getByTestId('qb-tally')).toBeInTheDocument();
  });
});

describe('QB mode helpers', () => {
  const players = [
    { id: 'q', role: 'QB', label: 'QB' },
    { id: 'a', role: 'WR', label: 'A' },
    { id: 'b', role: 'WR', label: 'B' },
    { id: 'c', role: 'TE', label: 'C' },
  ];
  it('orders keys by read windows, then the remaining receivers', () => {
    const result = {
      metrics: { reads: { windows: [{ id: 'c' }, { id: 'a' }] } },
    } as unknown as SimResult;
    expect(buildQbKeyMap(result, players).map((k) => `${k.key}:${k.label}`)).toEqual(['Q:C', 'W:A', 'E:B']);
    expect(buildQbKeyMap(null, players).map((k) => k.label)).toEqual(['A', 'B', 'C']);
  });

  it('feedback picks the best receiver and flags a best choice', () => {
    const result = {
      frames: [
        { t: 0, qb: { scores: { a: 40, b: 85, c: 60 } } },
        { t: 1, qb: { scores: { a: 90, b: 10, c: 10 } } },
      ],
      metrics: { separation: { a: [{ t: 0, d: 3.2 }] } },
    } as unknown as SimResult;
    const keys = buildQbKeyMap(null, players);
    const fb = qbFeedback(result, keys, { targetId: 'a', t: 0.5 });
    expect(fb.score).toBe(40);
    expect(fb.separation).toBe(3.2);
    expect(fb.best).toEqual({ id: 'b', label: 'B', score: 85 });
    expect(fb.isBest).toBe(false);
    expect(qbFeedback(result, keys, { targetId: 'a', t: 1 }).isBest).toBe(true);
  });
});
