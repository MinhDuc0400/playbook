import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { RING_COLORS } from '@/components/field/PlayerToken';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { Play, SimResult } from '@/domain/types';
import { frameAt } from '@/engine/frames';
import { simulate } from '@/engine/simulate';
import {
  cover3Play,
  floodPlay,
  makeInput,
  makePlay,
  rusherSlot,
  slot,
  zoneSlot,
} from '@/engine/__tests__/fixtures';
import { useMatchupStore } from '@/store/matchupStore';
import type { BuiltSim } from '../buildSimInput';
import { MatchupField } from '../MatchupField';
import { separationClass } from '../overlays';

const field = createDefaultFields()['5v5'];
const W = 800;
const H = 600;

class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

function manDefense(): Play {
  return makePlay('defense', [
    slot('m-cb', 'CB', 'CB1', { x: 11, y: 6 }, [
      { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' },
    ]),
    zoneSlot('m-fs', 'S', 'FS', { x: 0, y: 11 }, 'deep-third-M', { x: 0, y: 16 }, 'head-up'),
    { ...rusherSlot(), id: 'm-r1' },
  ]);
}

function build(defense: Play): { built: BuiltSim; result: SimResult } {
  const input = makeInput(floodPlay(), defense);
  const built: BuiltSim = {
    input,
    offense: input.offense,
    defense: input.defense,
    defenseFlipped: false,
  };
  return { built, result: simulate(input) };
}

let zoneSim: ReturnType<typeof build>;
let manSim: ReturnType<typeof build>;

beforeAll(() => {
  zoneSim = build(cover3Play());
  manSim = build(manDefense());
});

beforeEach(() => {
  useMatchupStore.getState().reset();
  vi.stubGlobal('PointerEvent', FakePointerEvent);
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

function renderField(
  sim: { built: BuiltSim; result: SimResult },
  t: number,
  extra: Partial<React.ComponentProps<typeof MatchupField>> = {},
) {
  const ui = (tt: number) => (
    <MatchupField
      built={sim.built}
      result={sim.result}
      t={tt}
      field={field}
      ballSpot={DEFAULT_BALL_SPOT}
      levels={{}}
      {...extra}
    />
  );
  const r = render(ui(t));
  return { ...r, rerenderAt: (tt: number) => r.rerender(ui(tt)) };
}

function bodyCenter(label: string): { x: number; y: number } {
  const body = screen.getByTestId(`token-${label}`).querySelector('[data-part="body"]')!;
  return { x: Number(body.getAttribute('cx')), y: Number(body.getAttribute('cy')) };
}

function lastThrowT(sim: { result: SimResult }): number {
  const f = sim.result.frames.find((fr) => fr.ball.state === 'inAir');
  return f!.ball.tThrow ?? f!.t;
}

describe('MatchupField', () => {
  it('NFR-ARC-03 tokens sit exactly at toScreen(frame position) for two different t', () => {
    const { result } = zoneSim;
    const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
    const t1 = 0.5;
    const t2 = 1.5;
    const { rerenderAt } = renderField(zoneSim, t1);
    expect(screen.getByTestId('matchup-field')).toBeInTheDocument();
    const slotZ = zoneSim.built.offense.players.find((p) => p.label === 'Z')!;
    const expect1 = toScreen(frameAt(result.frames, t1)!.players[slotZ.id]!.pos, vp);
    expect(bodyCenter('Z').x).toBeCloseTo(expect1.x);
    expect(bodyCenter('Z').y).toBeCloseTo(expect1.y);
    rerenderAt(t2);
    const expect2 = toScreen(frameAt(result.frames, t2)!.players[slotZ.id]!.pos, vp);
    expect(expect2).not.toEqual(expect1);
    expect(bodyCenter('Z').x).toBeCloseTo(expect2.x);
    expect(bodyCenter('Z').y).toBeCloseTo(expect2.y);
  });

  it('renders one token per player and the ball', () => {
    renderField(zoneSim, 0);
    for (const p of [...zoneSim.built.offense.players, ...zoneSim.built.defense.players]) {
      expect(screen.getByTestId(`token-${p.label}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('ball')).toBeInTheDocument();
  });

  it('plannedRoutes overlay toggles with the store', () => {
    renderField(zoneSim, 1);
    expect(screen.getByTestId('overlay-route-Z')).toBeInTheDocument();
    act(() => useMatchupStore.getState().toggleOverlay('plannedRoutes'));
    expect(screen.queryByTestId('overlay-route-Z')).toBeNull();
  });

  it('trails overlay is off by default, then draws a trail per moving player', () => {
    renderField(zoneSim, 1.5);
    expect(screen.queryByTestId('overlay-trail-Z')).toBeNull();
    act(() => useMatchupStore.getState().toggleOverlay('trails'));
    expect(screen.getByTestId('overlay-trail-Z')).toBeInTheDocument();
  });

  it('zones overlay toggles and is hidden by hideDefenseOverlays', () => {
    const { rerender } = renderField(zoneSim, 1);
    expect(screen.getByTestId('overlay-zone-CB1')).toBeInTheDocument();
    act(() => useMatchupStore.getState().toggleOverlay('zones'));
    expect(screen.queryByTestId('overlay-zone-CB1')).toBeNull();
    act(() => useMatchupStore.getState().toggleOverlay('zones'));
    expect(screen.getByTestId('overlay-zone-CB1')).toBeInTheDocument();
    rerender(
      <MatchupField
        built={zoneSim.built}
        result={zoneSim.result}
        t={1}
        field={field}
        ballSpot={DEFAULT_BALL_SPOT}
        levels={{}}
        hideDefenseOverlays
      />,
    );
    expect(screen.queryByTestId('overlay-zone-CB1')).toBeNull();
  });

  it('manLines overlay joins the defender to its bound receiver at the current frame; toggles and hides', () => {
    const { result } = manSim;
    const t = 1;
    const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
    const { rerender } = renderField(manSim, t);
    const line = screen.getByTestId('overlay-man-CB1');
    expect(line).toHaveAttribute('data-variant', 'man');
    // #1 strong receiver of the flood play is Z (x = 12).
    const frame = frameAt(result.frames, t)!;
    const z = manSim.built.offense.players.find((p) => p.label === 'Z')!;
    const cb = manSim.built.defense.players.find((p) => p.label === 'CB1')!;
    const a = toScreen(frame.players[cb.id]!.pos, vp);
    const b = toScreen(frame.players[z.id]!.pos, vp);
    const d = line.querySelector('[data-part="line"]')!.getAttribute('d')!;
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums[0]).toBeCloseTo(a.x);
    expect(nums[1]).toBeCloseTo(a.y);
    expect(nums[nums.length - 2]).toBeCloseTo(b.x);
    expect(nums[nums.length - 1]).toBeCloseTo(b.y);

    act(() => useMatchupStore.getState().toggleOverlay('manLines'));
    expect(screen.queryByTestId('overlay-man-CB1')).toBeNull();
    act(() => useMatchupStore.getState().toggleOverlay('manLines'));
    rerender(
      <MatchupField
        built={manSim.built}
        result={manSim.result}
        t={t}
        field={field}
        ballSpot={DEFAULT_BALL_SPOT}
        levels={{}}
        hideDefenseOverlays
      />,
    );
    expect(screen.queryByTestId('overlay-man-CB1')).toBeNull();
  });

  it('ballPath overlay appears only after the throw time and toggles', () => {
    const tThrow = lastThrowT(zoneSim);
    expect(Number.isFinite(tThrow)).toBe(true);
    const { rerenderAt } = renderField(zoneSim, Math.max(0, tThrow - 0.2));
    expect(screen.queryByTestId('overlay-ball')).toBeNull();
    rerenderAt(tThrow + 0.1);
    expect(screen.getByTestId('overlay-ball')).toBeInTheDocument();
    act(() => useMatchupStore.getState().toggleOverlay('ballPath'));
    expect(screen.queryByTestId('overlay-ball')).toBeNull();
  });

  it('separation labels show the metric value for receivers only and toggle', () => {
    const t = 1.2;
    renderField(zoneSim, t);
    const z = zoneSim.built.offense.players.find((p) => p.label === 'Z')!;
    const series = zoneSim.result.metrics.separation[z.id]!;
    const expected = [...series].filter((e) => e.t <= t).pop()!.d;
    expect(screen.getByTestId('sep-Z')).toHaveTextContent(expected.toFixed(1));
    expect(screen.queryByTestId('sep-Q')).toBeNull();
    act(() => useMatchupStore.getState().toggleOverlay('separation'));
    expect(screen.queryByTestId('sep-Z')).toBeNull();
  });

  it('FR-MU-06 separation colour: red < 1, amber 1-2.5, green > 2.5', () => {
    expect(separationClass(0.5, 1, 2.5)).toContain('red');
    expect(separationClass(1, 1, 2.5)).toContain('amber');
    expect(separationClass(2.5, 1, 2.5)).toContain('amber');
    expect(separationClass(2.6, 1, 2.5)).toContain('green');
  });

  it('separation label uses the colour class of its value', () => {
    renderField(zoneSim, 1.2);
    const z = zoneSim.built.offense.players.find((p) => p.label === 'Z')!;
    const d = [...zoneSim.result.metrics.separation[z.id]!].filter((e) => e.t <= 1.2).pop()!.d;
    const { separationTight, separationOpen } = zoneSim.built.input.tuning;
    expect(screen.getByTestId('sep-Z').getAttribute('class')).toBe(
      separationClass(d, separationTight, separationOpen),
    );
  });

  it('FR-ATH-02 ring colour follows levels', () => {
    const z = zoneSim.built.offense.players.find((p) => p.label === 'Z')!;
    const y = zoneSim.built.offense.players.find((p) => p.label === 'Y')!;
    renderField(zoneSim, 0, { levels: { [z.id]: 'weak', [y.id]: 'custom' } });
    const stroke = (l: string) =>
      screen.getByTestId(`token-${l}`).querySelector('[data-part="body"]')!.getAttribute('stroke');
    expect(stroke('Z')).toBe(RING_COLORS.weak);
    expect(stroke('Y')).toBe(RING_COLORS.custom);
  });

  it('clicking a token selects it in the store', () => {
    renderField(zoneSim, 0);
    const z = zoneSim.built.offense.players.find((p) => p.label === 'Z')!;
    fireEvent.pointerDown(screen.getByTestId('token-Z'));
    expect(useMatchupStore.getState().selected).toEqual({ side: 'offense', slotId: z.id, label: 'Z' });
    expect(screen.getByTestId('token-Z').querySelector('[data-part="selection"]')).not.toBeNull();
    fireEvent.pointerDown(screen.getByTestId('token-CB1'));
    expect(useMatchupStore.getState().selected?.side).toBe('defense');
  });
});
