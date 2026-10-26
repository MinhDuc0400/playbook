import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { Play, Point } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { EditorCanvas } from '../EditorCanvas';
import {
  applyRouteTemplate,
  getMotion,
  getRoute,
  movePlayer,
  routeStart,
  setMotion,
  setMotionDuration,
  setOptionRoute,
  setRouteDelay,
} from '../ops';
import { motionTool } from '../tools/motionTool';
import { optionTool } from '../tools/optionTool';
import type { EditorTool, FieldPointerEvent, HitTarget, ToolContext } from '../tools/types';
import { offenseFixture } from './fixtures';

const field = createDefaultFields()['5v5'];
const store = () => useEditorStore.getState();
const play = (): Play => {
  const p = store().play;
  if (!p) throw new Error('no play');
  return p;
};
const slotOf = (id: string) => {
  const s = play().players.find((p) => p.id === id);
  if (!s) throw new Error(id);
  return s;
};
const history = () => useEditorStore.temporal.getState().pastStates.length;
const ctx: ToolContext = {
  getState: useEditorStore.getState,
  field,
  ballSpot: DEFAULT_BALL_SPOT,
  maxPlayers: field.playersPerSide,
  idGen: () => 'id',
};
const ev = (point: Point, target: HitTarget = { kind: 'field' }): FieldPointerEvent => ({
  point,
  raw: point,
  target,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  button: 0,
  detail: 1,
});
const key = (k: string) => new KeyboardEvent('keydown', { key: k });
const click = (tool: EditorTool, p: Point, target?: HitTarget) => tool.onPointerDown?.(ev(p, target), ctx);
const onPlayer = (slotId: string): HitTarget => ({ kind: 'player', slotId });

beforeEach(() => {
  store().load(offenseFixture());
});

describe('FR-OFF-07 FR-OFF-08 FR-OFF-09 ops: motion / option / delay', () => {
  it('setMotion adds, replaces, removes; default duration 1; immutable', () => {
    const before = play();
    const snapshot = JSON.stringify(before);
    const a = setMotion('z', [
      { x: 4, y: 0 },
      { x: 2, y: 0 },
    ])(before);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(getMotion(a, 'z')).toEqual({
      type: 'motion',
      path: [
        { x: 4, y: 0 },
        { x: 2, y: 0 },
      ],
      duration: 1,
    });
    const b = setMotion('z', [{ x: 1, y: 0 }], 2)(a);
    expect(getMotion(b, 'z')?.duration).toBe(2);
    expect(getMotion(setMotion('z', null)(b), 'z')).toBeUndefined();
    expect(setMotion('z', null)(before)).toBe(before);
  });

  it('setMotionDuration changes only the duration', () => {
    const a = setMotion('z', [{ x: 4, y: 0 }])(play());
    expect(getMotion(setMotionDuration('z', 2.5)(a), 'z')).toMatchObject({ duration: 2.5 });
    expect(setMotionDuration('z', 1)(a)).toBe(a);
  });

  it('routeStart is the motion end, else the start', () => {
    expect(routeStart(play(), 'x')).toEqual({ x: -8, y: 0 });
    const a = setMotion('x', [
      { x: -6, y: 0 },
      { x: -3, y: 0 },
    ])(play());
    expect(routeStart(a, 'x')).toEqual({ x: -3, y: 0 });
  });

  it('template applied after a motion starts at the motion end', () => {
    const a = setMotion('z', [{ x: 5, y: 0 }])(play());
    const b = applyRouteTemplate('z', 'go', 10)(a);
    expect(getRoute(b, 'z')?.path.at(-1)).toEqual({ x: 5, y: 10 });
  });

  it('movePlayer translates motion with the player', () => {
    const a = setMotion('z', [{ x: 5, y: 0 }])(play());
    const b = movePlayer('z', { x: 9, y: 0 })(a);
    expect(getMotion(b, 'z')?.path).toEqual([{ x: 6, y: 0 }]);
  });

  it('setRouteDelay sets, and 0 removes the field', () => {
    const a = setRouteDelay('x', 0.5)(play());
    expect(getRoute(a, 'x')?.delay).toBe(0.5);
    const b = setRouteDelay('x', 0)(a);
    expect(getRoute(b, 'x') && 'delay' in (getRoute(b, 'x') ?? {})).toBe(false);
    expect(setRouteDelay('z', 1)(play())).toEqual(play());
  });

  it('setOptionRoute replaces the route and null removes the option', () => {
    const opt = { stem: [{ x: -8, y: 6 }], vsMan: [{ x: -4, y: 10 }], vsZone: [{ x: -12, y: 10 }] };
    const a = setOptionRoute('x', opt)(play());
    const acts = slotOf('x').actions;
    expect(acts.some((x) => x.type === 'route')).toBe(true);
    expect(a.players.find((p) => p.id === 'x')?.actions.map((x) => x.type)).toEqual(['option']);
    const b = setOptionRoute('x', null)(a);
    expect(b.players.find((p) => p.id === 'x')?.actions).toEqual([]);
  });
});

describe('FR-OFF-07 motionTool', () => {
  it('player + 2 clicks + Enter makes a motion (duration 1) in one undo step', () => {
    click(motionTool, { x: 8, y: 0 }, onPlayer('z'));
    click(motionTool, { x: 6, y: 0 });
    click(motionTool, { x: 3, y: 0 });
    expect(history()).toBe(0);
    expect(motionTool.onKeyDown?.(key('Enter'), ctx)).toBe(true);
    expect(getMotion(play(), 'z')).toEqual({
      type: 'motion',
      path: [
        { x: 6, y: 0 },
        { x: 3, y: 0 },
      ],
      duration: 1,
    });
    expect(store().draft).toBeNull();
    expect(history()).toBe(1);
  });

  it('Esc cancels; QB is ignored', () => {
    click(motionTool, { x: 0, y: -5 }, onPlayer('q'));
    expect(store().draft).toBeNull();
    click(motionTool, { x: 8, y: 0 }, onPlayer('z'));
    click(motionTool, { x: 6, y: 0 });
    expect(motionTool.onKeyDown?.(key('Escape'), ctx)).toBe(true);
    expect(store().draft).toBeNull();
    expect(getMotion(play(), 'z')).toBeUndefined();
    expect(history()).toBe(0);
  });
});

describe('FR-OFF-08 optionTool', () => {
  it('stem, vsMan, vsZone each closed with Enter makes an option action', () => {
    click(optionTool, { x: 8, y: 0 }, onPlayer('z'));
    click(optionTool, { x: 8, y: 6 });
    optionTool.onKeyDown?.(key('Enter'), ctx);
    click(optionTool, { x: 4, y: 10 });
    optionTool.onKeyDown?.(key('Enter'), ctx);
    click(optionTool, { x: 12, y: 10 });
    expect(history()).toBe(0);
    optionTool.onKeyDown?.(key('Enter'), ctx);
    expect(slotOf('z').actions).toEqual([
      {
        type: 'option',
        stem: [{ x: 8, y: 6 }],
        vsMan: [{ x: 4, y: 10 }],
        vsZone: [{ x: 12, y: 10 }],
        decideAtStemEnd: true,
      },
    ]);
    expect(history()).toBe(1);
    expect(store().draft).toBeNull();
  });

  it('Esc cancels mid-way; Enter with no points in a phase does not advance', () => {
    click(optionTool, { x: 8, y: 0 }, onPlayer('z'));
    optionTool.onKeyDown?.(key('Enter'), ctx);
    expect(store().draft?.kind === 'generic' && store().draft).toMatchObject({ data: { phase: 'stem' } });
    click(optionTool, { x: 8, y: 6 });
    optionTool.onKeyDown?.(key('Enter'), ctx);
    expect(optionTool.onKeyDown?.(key('Escape'), ctx)).toBe(true);
    expect(store().draft).toBeNull();
    expect(slotOf('z').actions).toEqual([]);
    expect(history()).toBe(0);
  });
});

describe('canvas rendering', () => {
  const W = 800;
  const H = 600;
  const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);
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
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a zigzag motion and option branches with M / Z', () => {
    act(() => {
      store().apply('m', setMotion('x', [{ x: -5, y: 0 }]));
      store().apply(
        'o',
        setOptionRoute('z', { stem: [{ x: 8, y: 6 }], vsMan: [{ x: 4, y: 10 }], vsZone: [{ x: 12, y: 10 }] }),
      );
    });
    render(<EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap />);
    expect(screen.getByTestId('motion-X')).toHaveAttribute('data-variant', 'motion');
    expect(screen.getByTestId('option-man-Z')).toHaveAttribute('data-variant', 'option-man');
    expect(screen.getByTestId('option-zone-Z')).toHaveAttribute('data-variant', 'option-zone');
    expect(screen.getByTestId('option-man-Z').textContent).toContain('M');
    expect(screen.getByTestId('option-zone-Z').textContent).toContain('Z');
  });

  it('shows a dashed draft while drawing a motion', () => {
    store().setTool('motion');
    render(<EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap />);
    const svg = screen.getByTestId('field-svg');
    const at = (p: Point) => {
      const s = toScreen(p, vp);
      return { clientX: s.x, clientY: s.y, pointerId: 1 };
    };
    fireEvent.pointerDown(screen.getByTestId('token-Z'), at({ x: 8, y: 0 }));
    fireEvent.pointerUp(screen.getByTestId('token-Z'), { pointerId: 1 });
    fireEvent.pointerDown(svg, at({ x: 6, y: 0 }));
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(screen.getByTestId('motion-draft')).toBeInTheDocument();
  });
});
