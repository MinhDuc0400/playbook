import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { alignedPlayers, numberReceivers, refForPlayer } from '@/domain/numbering';
import type { ManAction, Point, Role } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { EditorCanvas, ROLE_DRAG_TYPE } from '../EditorCanvas';
import { mkPlay, offenseFixture, slot } from './fixtures';

const field = createDefaultFields()['5v5'];
const W = 800;
const H = 600;
const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
const store = () => useEditorStore.getState();
const px = (p: Point) => {
  const s = toScreen(p, vp);
  return { clientX: s.x, clientY: s.y };
};

const defense = () =>
  mkPlay([slot('d1', 'CB', { x: -8, y: 5 }, [], 'D1'), slot('d2', 'S', { x: 0, y: 8 }, [], 'D2')], {
    id: 'def',
    side: 'defense',
  });

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

const renderCanvas = (props: Partial<React.ComponentProps<typeof EditorCanvas>> = {}) =>
  render(<EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap={false} {...props} />);

describe('T-FS-02 passive layer', () => {
  it('is absent without a companion', () => {
    renderCanvas();
    expect(screen.queryByTestId('passive-layer')).toBeNull();
  });

  it('renders the companion read-only with pointer-events none', () => {
    store().load(defense(), offenseFixture());
    renderCanvas();
    const layer = screen.getByTestId('passive-layer');
    expect(layer.getAttribute('pointer-events')).toBe('none');
    expect(layer.getAttribute('opacity')).toBe('0.45');
    expect(layer.querySelector('[data-testid="token-X"]')).not.toBeNull();
    expect(layer.querySelector('[data-testid="route-X"]')).not.toBeNull();
    expect(screen.queryByTestId('ghost-layer')).toBeNull();
  });
});

describe('T-FS-02 man tool on the live offense', () => {
  it('stores the strong/weak #n ref computed from the live offense', () => {
    const off = offenseFixture();
    store().load(defense(), off);
    store().setTool('man');
    renderCanvas();
    const svg = screen.getByTestId('field-svg');
    fireEvent.pointerDown(screen.getByTestId('token-D1'), { pointerId: 1, ...px({ x: -8, y: 5 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(store().draft?.kind).toBe('man');
    const hit = screen.getByTestId('live-hit-X');
    fireEvent.pointerDown(hit, { pointerId: 1, ...px({ x: -8, y: 0 }) });
    const players = alignedPlayers(off);
    const expected = refForPlayer('x', numberReceivers(players), players);
    expect(expected).not.toBeNull();
    const man = store()
      .play?.players.find((p) => p.id === 'd1')
      ?.actions.find((a): a is ManAction => a.type === 'man');
    expect(man?.target).toEqual(expected);
    expect(JSON.stringify(man)).not.toContain('"x"}');
    expect(store().draft).toBeNull();
  });

  it('renders the live hit layer only for the man tool', () => {
    store().load(defense(), offenseFixture());
    renderCanvas();
    expect(screen.queryByTestId('live-offense-hit-layer')).toBeNull();
    act(() => store().setTool('man'));
    expect(screen.getByTestId('live-offense-hit-layer')).toBeInTheDocument();
  });
});

describe('T-FS-02 placement hooks', () => {
  it('drop of a role calls onPlace with the field point', () => {
    const onPlace = vi.fn();
    renderCanvas({ onPlace });
    const el = screen.getByTestId('editor-canvas');
    const ev = createEvent.drop(el);
    const at = px({ x: 3, y: 4 });
    Object.defineProperty(ev, 'clientX', { value: at.clientX });
    Object.defineProperty(ev, 'clientY', { value: at.clientY });
    Object.defineProperty(ev, 'dataTransfer', {
      value: { types: [ROLE_DRAG_TYPE], getData: (t: string) => (t === ROLE_DRAG_TYPE ? 'WR' : '') },
    });
    fireEvent(el, ev);
    expect(onPlace).toHaveBeenCalledTimes(1);
    const [role, pt] = onPlace.mock.calls[0] as [Role, Point];
    expect(role).toBe('WR');
    expect(pt.x).toBeCloseTo(3, 1);
    expect(pt.y).toBeCloseTo(4, 1);
  });

  it('pointerdown on the bare field with pendingRole calls onPlace, not the tool', () => {
    const onPlace = vi.fn();
    store().setTool('place');
    renderCanvas({ onPlace, pendingRole: 'RB' });
    const before = store().play?.players.length;
    fireEvent.pointerDown(screen.getByTestId('field-svg'), { pointerId: 1, ...px({ x: 2, y: -3 }) });
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace.mock.calls[0]?.[0]).toBe('RB');
    expect(store().play?.players.length).toBe(before);
  });

  it('without pendingRole a field click does not call onPlace', () => {
    const onPlace = vi.fn();
    renderCanvas({ onPlace });
    fireEvent.pointerDown(screen.getByTestId('field-svg'), { pointerId: 1, ...px({ x: 2, y: -3 }) });
    expect(onPlace).not.toHaveBeenCalled();
  });
});
