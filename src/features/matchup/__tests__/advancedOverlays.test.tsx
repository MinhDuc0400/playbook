import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { SimResult } from '@/domain/types';
import { frameAt } from '@/engine/frames';
import { simulate } from '@/engine/simulate';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { useMatchupStore } from '@/store/matchupStore';
import type { BuiltSim } from '../buildSimInput';
import { MatchupField } from '../MatchupField';

const field = createDefaultFields()['5v5'];
const W = 800;
const H = 600;
let built: BuiltSim;
let result: SimResult;

beforeAll(() => {
  const input = makeInput(floodPlay(), cover3Play());
  built = { input, offense: input.offense, defense: input.defense, defenseFlipped: false };
  result = simulate(input, { debug: true });
});

beforeEach(() => {
  useMatchupStore.getState().reset();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: W,
    bottom: H,
    width: W,
    height: H,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderAt = (t: number, sim: SimResult = result) =>
  render(
    <MatchupField built={built} result={sim} t={t} field={field} ballSpot={DEFAULT_BALL_SPOT} levels={{}} />,
  );

function ghostCenter(label: string): { x: number; y: number } {
  const c = screen.getByTestId(`perceived-${label}`).querySelector('circle')!;
  return { x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) };
}

/** First frame time where the debug defender's aim exists and a receiver is moving. */
function movingT(defId: string): number {
  const i = result.frames.findIndex(
    (f, k) =>
      f.t > 1 &&
      result.debug!.defenders[k]?.[defId]?.aim !== undefined &&
      Object.entries(result.debug!.defenders[k]![defId]!.seen).some(
        ([id, p]) => Math.hypot(p.x - f.players[id]!.pos.x, p.y - f.players[id]!.pos.y) > 0.05,
      ),
  );
  expect(i).toBeGreaterThanOrEqual(0);
  return result.frames[i]!.t;
}

describe('FR-MU-11 perception overlay', () => {
  it('draws ghosts at the debug seen positions (not true ones), aim crosshair and line', () => {
    const def = built.defense.players[0]!;
    const t = movingT(def.id);
    useMatchupStore.getState().setDebugDefender(def.id);
    useMatchupStore.getState().setOverlay('perception', true);
    renderAt(t);
    const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
    const frame = frameAt(result.frames, t)!;
    const dbg = result.debug!.defenders[result.frames.indexOf(frame)]![def.id]!;
    let differs = 0;
    for (const slot of built.offense.players) {
      const seen = dbg.seen[slot.id];
      if (!seen) continue;
      const exp = toScreen(seen, vp);
      const got = ghostCenter(slot.label);
      expect(got.x).toBeCloseTo(exp.x);
      expect(got.y).toBeCloseTo(exp.y);
      const truth = toScreen(frame.players[slot.id]!.pos, vp);
      if (Math.hypot(truth.x - got.x, truth.y - got.y) > 0.5) differs += 1;
    }
    expect(differs).toBeGreaterThan(0);
    expect(screen.getByTestId('perceived-aim')).toBeInTheDocument();
    expect(screen.getByTestId('perceived-aim-line')).toBeInTheDocument();
  });

  it('is hidden when the overlay is off or no defender is chosen', () => {
    const def = built.defense.players[0]!;
    const t = movingT(def.id);
    useMatchupStore.getState().setDebugDefender(def.id);
    renderAt(t);
    expect(screen.queryByTestId('overlay-perception')).toBeNull();
    cleanup();
    useMatchupStore.getState().setOverlay('perception', true);
    useMatchupStore.getState().setDebugDefender(null);
    renderAt(t);
    expect(screen.queryByTestId('overlay-perception')).toBeNull();
  });

  it('selecting a defender while the overlay is on sets the debug defender', () => {
    const def = built.defense.players[0]!;
    useMatchupStore.getState().select({ side: 'defense', slotId: def.id, label: def.label });
    expect(useMatchupStore.getState().debugDefenderId).toBeNull();
    useMatchupStore.getState().setOverlay('perception', true);
    useMatchupStore.getState().select({ side: 'defense', slotId: def.id, label: def.label });
    expect(useMatchupStore.getState().debugDefenderId).toBe(def.id);
  });
});

describe('FR-MU-12 QB eyes overlay', () => {
  it('draws a line from the QB to the eyeTarget player', () => {
    const f = result.frames.find((fr) => fr.eyeTarget !== undefined);
    expect(f).toBeDefined();
    renderAt(f!.t);
    const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
    const qb = built.offense.players.find((p) => p.role === 'QB')!;
    const a = toScreen(f!.players[qb.id]!.pos, vp);
    const b = toScreen(f!.players[f!.eyeTarget!]!.pos, vp);
    const line = screen.getByTestId('qb-eye-line');
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(a.x);
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(a.y);
    expect(Number(line.getAttribute('x2'))).toBeCloseTo(b.x);
    expect(Number(line.getAttribute('y2'))).toBeCloseTo(b.y);
  });

  it('is absent when toggled off', () => {
    const f = result.frames.find((fr) => fr.eyeTarget !== undefined)!;
    useMatchupStore.getState().setOverlay('qbEyes', false);
    renderAt(f.t);
    expect(screen.queryByTestId('qb-eye-line')).toBeNull();
  });
});
