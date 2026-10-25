import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toField, toScreen } from '@/components/field/viewport';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { snapToGrid } from '@/domain/geometry';
import type { Point } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { EditorCanvas } from '../EditorCanvas';
import { getRoute } from '../ops';
import { mkPlay, offenseFixture } from './fixtures';

const field = createDefaultFields()['5v5'];
const W = 800;
const H = 600;
const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
const store = () => useEditorStore.getState();

/** Client coordinates of a field point (the svg is at the page origin). */
const px = (p: Point) => {
  const s = toScreen(p, vp);
  return { clientX: s.x, clientY: s.y };
};

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
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
  store().load(offenseFixture());
  store().setTool('select');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCanvas(snap = true) {
  render(<EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap={snap} />);
  return screen.getByTestId('field-svg');
}

describe('EditorCanvas rendering', () => {
  it('renders a token per player and a route per player with a route', () => {
    renderCanvas();
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument();
    for (const label of ['Q', 'C', 'X', 'Z'])
      expect(screen.getByTestId(`token-${label}`)).toBeInTheDocument();
    expect(screen.getByTestId('route-X')).toBeInTheDocument();
    expect(screen.queryByTestId('route-Z')).toBeNull();
  });

  it('shows route handles only for the selected player', () => {
    renderCanvas();
    expect(document.querySelectorAll('[data-kind="routePoint"]')).toHaveLength(0);
    fireEvent.pointerDown(screen.getByTestId('token-X'), { pointerId: 1, ...px({ x: -8, y: 0 }) });
    fireEvent.pointerUp(screen.getByTestId('token-X'), { pointerId: 1 });
    expect(document.querySelectorAll('[data-kind="routePoint"]')).toHaveLength(2);
  });
});

describe('EditorCanvas place tool (FR-ED-02, FR-ED-03)', () => {
  beforeEach(() => {
    store().load(mkPlay([]));
    store().setTool('place');
  });

  it('adds a token at the snapped point', () => {
    const svg = renderCanvas();
    const click = px({ x: 3.2, y: 4.1 });
    fireEvent.pointerDown(svg, { pointerId: 1, ...click });
    fireEvent.pointerUp(svg, { pointerId: 1, ...click });
    const expected = snapToGrid(toField({ x: click.clientX, y: click.clientY }, vp), 0.5);
    expect(store().play?.players).toHaveLength(1);
    expect(store().play?.players[0]?.start).toEqual(expected);
    expect(expected).toEqual({ x: 3, y: 4 });
    expect(screen.getByTestId('token-Q')).toBeInTheDocument();
  });

  it('does not snap while Alt is held', () => {
    const svg = renderCanvas();
    fireEvent.pointerDown(svg, { pointerId: 1, altKey: true, ...px({ x: 3.2, y: 4.1 }) });
    const start = store().play?.players[0]?.start;
    expect(start?.x).toBeCloseTo(3.2);
    expect(start?.y).toBeCloseTo(4.1);
  });

  it('does not snap when the snap setting is off', () => {
    const svg = renderCanvas(false);
    fireEvent.pointerDown(svg, { pointerId: 1, ...px({ x: 3.2, y: 4.1 }) });
    expect(store().play?.players[0]?.start.x).toBeCloseTo(3.2);
  });

  it('ignores pointer input while Space is held (pan)', () => {
    const svg = renderCanvas();
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.pointerDown(svg, { pointerId: 1, ...px({ x: 3, y: 4 }) });
    expect(store().play?.players).toHaveLength(0);
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    fireEvent.pointerDown(svg, { pointerId: 1, ...px({ x: 3, y: 4 }) });
    expect(store().play?.players).toHaveLength(1);
  });
});

describe('EditorCanvas select tool', () => {
  it('drags a player with the pointer', () => {
    const svg = renderCanvas();
    const token = screen.getByTestId('token-Z');
    fireEvent.pointerDown(token, { pointerId: 1, ...px({ x: 8, y: 0 }) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...px({ x: 9, y: 2 }) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...px({ x: 10, y: 3 }) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...px({ x: 10, y: 3 }) });
    expect(store().play?.players.find((s) => s.id === 'z')?.start).toEqual({ x: 10, y: 3 });
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);
  });

  it('double-click on a route handle toggles smooth; Delete removes the selected player', () => {
    const svg = renderCanvas();
    fireEvent.pointerDown(screen.getByTestId('token-X'), { pointerId: 1, ...px({ x: -8, y: 0 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    const handle = document.querySelector('[data-kind="routePoint"][data-index="0"]');
    expect(handle).not.toBeNull();
    fireEvent.pointerDown(handle as Element, { pointerId: 1, ...px({ x: -8, y: 10 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.doubleClick(svg, px({ x: -8, y: 10 }));
    expect(store().play && getRoute(store().play!, 'x')?.smooth?.[0]).toBe(true);

    fireEvent.pointerDown(screen.getByTestId('token-Z'), { pointerId: 1, ...px({ x: 8, y: 0 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.queryByTestId('token-Z')).toBeNull();
  });
});

describe('EditorCanvas route tool (FR-OFF-01)', () => {
  const draw = (svg: Element) => {
    fireEvent.pointerDown(screen.getByTestId('token-Z'), { pointerId: 1, ...px({ x: 8, y: 0 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    for (const p of [
      { x: 8, y: 6 },
      { x: 12, y: 10 },
      { x: 12, y: 16 },
    ]) {
      fireEvent.pointerDown(svg, { pointerId: 1, ...px(p) });
      fireEvent.pointerUp(svg, { pointerId: 1, ...px(p) });
    }
    fireEvent.pointerMove(svg, { pointerId: 1, ...px({ x: 12, y: 20 }) });
  };

  beforeEach(() => store().setTool('route'));

  it('draws a draft preview, then Enter creates route-<label>', () => {
    const svg = renderCanvas();
    expect(screen.queryByTestId('route-draft')).toBeNull();
    draw(svg);
    expect(screen.getByTestId('route-draft')).toBeInTheDocument();
    expect(screen.queryByTestId('route-Z')).toBeNull();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByTestId('route-draft')).toBeNull();
    expect(screen.getByTestId('route-Z')).toBeInTheDocument();
    expect(store().play && getRoute(store().play!, 'z')?.path).toEqual([
      { x: 8, y: 6 },
      { x: 12, y: 10 },
      { x: 12, y: 16 },
    ]);
  });

  it('forwards Escape to the tool, which cancels the draft', () => {
    const svg = renderCanvas();
    draw(svg);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('route-draft')).toBeNull();
    expect(store().draft).toBeNull();
    expect(screen.queryByTestId('route-Z')).toBeNull();
  });

  it('ignores key events that originate in an input', () => {
    const svg = renderCanvas();
    draw(svg);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(store().draft).not.toBeNull();
    expect(screen.queryByTestId('route-Z')).toBeNull();
    input.remove();
  });

  it('switching tools clears the draft', () => {
    const svg = renderCanvas();
    draw(svg);
    expect(store().draft).not.toBeNull();
    act(() => store().setTool('select'));
    expect(store().draft).toBeNull();
    expect(screen.queryByTestId('route-draft')).toBeNull();
  });
});
