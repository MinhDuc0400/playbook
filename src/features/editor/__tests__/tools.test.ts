import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { Play, Point } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { getRoute } from '../ops';
import { placeTool } from '../tools/placeTool';
import { routeTool } from '../tools/routeTool';
import { selectTool } from '../tools/selectTool';
import type { EditorTool, FieldPointerEvent, HitTarget, ToolContext } from '../tools/types';
import { mkPlay, offenseFixture } from './fixtures';

const field = createDefaultFields()['5v5'];
let n = 0;
const ctx: ToolContext = {
  getState: useEditorStore.getState,
  field,
  ballSpot: DEFAULT_BALL_SPOT,
  maxPlayers: field.playersPerSide,
  idGen: () => `id${++n}`,
};

const store = () => useEditorStore.getState();
const play = (): Play => {
  const p = store().play;
  if (!p) throw new Error('no play');
  return p;
};
const history = () => useEditorStore.temporal.getState().pastStates.length;
const FIELD: HitTarget = { kind: 'field' };

function ev(
  point: Point,
  target: HitTarget = FIELD,
  extra: Partial<FieldPointerEvent> = {},
): FieldPointerEvent {
  return {
    point,
    raw: point,
    target,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    button: 0,
    detail: 1,
    ...extra,
  };
}
const key = (k: string) => new KeyboardEvent('keydown', { key: k });
const onPlayer = (slotId: string): HitTarget => ({ kind: 'player', slotId });

function click(tool: EditorTool, e: FieldPointerEvent): void {
  tool.onPointerDown?.(e, ctx);
  tool.onPointerUp?.(e, ctx);
}

beforeEach(() => {
  n = 0;
  store().load(offenseFixture());
  store().setTool('select');
});

describe('placeTool (FR-ED-02)', () => {
  it('adds QB, then C, then WR with default labels and stops at the format max', () => {
    store().load(mkPlay([]));
    const clicks: Point[] = [
      { x: 0, y: -5 },
      { x: 0, y: 0 },
      { x: -8, y: 0 },
      { x: 8, y: 0 },
      { x: 4, y: 0 },
      { x: 12, y: 0 },
    ];
    for (const p of clicks) click(placeTool, ev(p));
    expect(play().players.map((s) => [s.role, s.label])).toEqual([
      ['QB', 'Q'],
      ['C', 'C'],
      ['WR', 'X'],
      ['WR', 'Z'],
      ['WR', 'Y'],
    ]);
    expect(play().players).toHaveLength(field.playersPerSide);
    expect(store().selection).toEqual([play().players[4]?.id]);
  });

  it('places defense CB x2, S x2, then LB', () => {
    store().load(mkPlay([], { side: 'defense' }));
    for (let i = 0; i < 5; i += 1) click(placeTool, ev({ x: i, y: 5 }));
    expect(play().players.map((s) => s.role)).toEqual(['CB', 'CB', 'S', 'S', 'LB']);
  });

  it('pressing a player drags it like the select tool', () => {
    placeTool.onPointerDown?.(ev({ x: 8, y: 0 }, onPlayer('z')), ctx);
    placeTool.onPointerMove?.(ev({ x: 9, y: 1 }), ctx);
    placeTool.onPointerUp?.(ev({ x: 9, y: 1 }), ctx);
    expect(play().players.find((s) => s.id === 'z')?.start).toEqual({ x: 9, y: 1 });
    expect(play().players).toHaveLength(4);
  });

  it('Delete removes the selected player', () => {
    store().select(['z']);
    expect(placeTool.onKeyDown?.(key('Delete'), ctx)).toBe(true);
    expect(play().players.map((s) => s.id)).not.toContain('z');
  });
});

describe('selectTool (FR-ED-02, FR-OFF-02)', () => {
  it('drags a player as one undo step', () => {
    const before = play();
    selectTool.onPointerDown?.(ev({ x: -8, y: 0 }, onPlayer('x')), ctx);
    expect(store().selection).toEqual(['x']);
    selectTool.onPointerMove?.(ev({ x: -7, y: 1 }), ctx);
    selectTool.onPointerMove?.(ev({ x: -6, y: 2 }), ctx);
    selectTool.onPointerMove?.(ev({ x: -5, y: 3 }), ctx);
    selectTool.onPointerUp?.(ev({ x: -5, y: 3 }), ctx);
    const x = play().players.find((s) => s.id === 'x');
    expect(x?.start).toEqual({ x: -5, y: 3 });
    expect(getRoute(play(), 'x')?.path[0]).toEqual({ x: -5, y: 13 }); // route follows the player
    expect(history()).toBe(1);
    store().undo();
    expect(play()).toEqual(before);
  });

  it('a click without movement records no history', () => {
    click(selectTool, ev({ x: -8, y: 0 }, onPlayer('x')));
    expect(history()).toBe(0);
  });

  it('shift toggles a player in the selection', () => {
    click(selectTool, ev({ x: -8, y: 0 }, onPlayer('x')));
    click(selectTool, ev({ x: 8, y: 0 }, onPlayer('z'), { shiftKey: true }));
    expect(store().selection).toEqual(['x', 'z']);
    click(selectTool, ev({ x: 8, y: 0 }, onPlayer('z'), { shiftKey: true }));
    expect(store().selection).toEqual(['x']);
  });

  it('drags a route point as one undo step and selects it', () => {
    selectTool.onPointerDown?.(ev({ x: -4, y: 14 }, { kind: 'routePoint', slotId: 'x', index: 1 }), ctx);
    expect(store().selectedPoint).toEqual({ slotId: 'x', index: 1 });
    expect(store().selection).toEqual(['x']);
    selectTool.onPointerMove?.(ev({ x: -3, y: 15 }), ctx);
    selectTool.onPointerMove?.(ev({ x: -2, y: 16 }), ctx);
    selectTool.onPointerUp?.(ev({ x: -2, y: 16 }), ctx);
    expect(getRoute(play(), 'x')?.path[1]).toEqual({ x: -2, y: 16 });
    expect(history()).toBe(1);
  });

  it('double-click on a route point toggles smooth', () => {
    selectTool.onDoubleClick?.(ev({ x: -8, y: 10 }, { kind: 'routePoint', slotId: 'x', index: 0 }), ctx);
    expect(getRoute(play(), 'x')?.smooth).toEqual([true, false]);
    selectTool.onDoubleClick?.(ev({ x: -8, y: 10 }, { kind: 'routePoint', slotId: 'x', index: 0 }), ctx);
    expect(getRoute(play(), 'x')?.smooth).toEqual([false, false]);
  });

  it('double-click on a segment inserts a point before the segment end', () => {
    selectTool.onDoubleClick?.(ev({ x: -6, y: 12 }, { kind: 'routeSegment', slotId: 'x', index: 1 }), ctx);
    expect(getRoute(play(), 'x')?.path).toEqual([
      { x: -8, y: 10 },
      { x: -6, y: 12 },
      { x: -4, y: 14 },
    ]);
    expect(store().selectedPoint).toEqual({ slotId: 'x', index: 1 });
  });

  it('Delete removes the selected route point, else the selected players', () => {
    click(selectTool, ev({ x: -8, y: 10 }, { kind: 'routePoint', slotId: 'x', index: 0 }));
    expect(selectTool.onKeyDown?.(key('Delete'), ctx)).toBe(true);
    expect(getRoute(play(), 'x')?.path).toEqual([{ x: -4, y: 14 }]);
    expect(store().selectedPoint).toBeNull();

    click(selectTool, ev({ x: 8, y: 0 }, onPlayer('z')));
    expect(selectTool.onKeyDown?.(key('Backspace'), ctx)).toBe(true);
    expect(play().players.map((s) => s.id)).toEqual(['q', 'c', 'x']);
    expect(store().selection).toEqual([]);
    expect(selectTool.onKeyDown?.(key('Delete'), ctx)).toBe(false);
  });

  it('field click clears selection and selected point; Escape clears selection', () => {
    click(selectTool, ev({ x: -4, y: 14 }, { kind: 'routePoint', slotId: 'x', index: 1 }));
    click(selectTool, ev({ x: 0, y: 20 }));
    expect(store().selection).toEqual([]);
    expect(store().selectedPoint).toBeNull();

    click(selectTool, ev({ x: 8, y: 0 }, onPlayer('z')));
    expect(selectTool.onKeyDown?.(key('Escape'), ctx)).toBe(true);
    expect(store().selection).toEqual([]);
  });
});

describe('routeTool (FR-OFF-01)', () => {
  const start = () => click(routeTool, ev({ x: 8, y: 0 }, onPlayer('z')));
  const A = { x: 8, y: 6 };
  const B = { x: 12, y: 10 };
  const C = { x: 12, y: 16 };

  it('3 clicks + Enter creates a route with 3 points', () => {
    start();
    expect(store().draft).toMatchObject({ kind: 'route', slotId: 'z', points: [] });
    expect(store().selection).toEqual(['z']);
    for (const p of [A, B, C]) click(routeTool, ev(p));
    routeTool.onPointerMove?.(ev({ x: 12, y: 20 }), ctx);
    expect(store().draft).toMatchObject({ points: [A, B, C], cursor: { x: 12, y: 20 } });

    expect(routeTool.onKeyDown?.(key('Enter'), ctx)).toBe(true);
    expect(getRoute(play(), 'z')).toEqual({
      type: 'route',
      path: [A, B, C],
      smooth: [false, false, false],
      endBehavior: 'continue',
    });
    expect(store().draft).toBeNull();
    expect(history()).toBe(1);
  });

  it('double-click finishes without a duplicate point', () => {
    start();
    click(routeTool, ev(A));
    click(routeTool, ev(B));
    routeTool.onPointerDown?.(ev(C, FIELD, { detail: 1 }), ctx);
    routeTool.onPointerDown?.(ev(C, FIELD, { detail: 2 }), ctx);
    routeTool.onDoubleClick?.(ev(C, FIELD, { detail: 2 }), ctx);
    expect(getRoute(play(), 'z')?.path).toEqual([A, B, C]);
    expect(store().draft).toBeNull();
  });

  it('Shift locks segments to 45 degrees', () => {
    start();
    click(routeTool, ev({ x: 13, y: 1 }, FIELD, { shiftKey: true })); // from (8,0): ~11 deg -> 0 deg
    const first = (store().draft as { points: Point[] }).points[0];
    expect(first?.y).toBeCloseTo(0);
    expect(first?.x).toBeGreaterThan(8);
    click(routeTool, ev({ x: (first?.x ?? 0) + 3, y: 3.5 }, FIELD, { shiftKey: true }));
    const second = (store().draft as { points: Point[] }).points[1];
    expect((second?.x ?? 0) - (first?.x ?? 0)).toBeCloseTo((second?.y ?? 0) - (first?.y ?? 0));
    routeTool.onPointerMove?.(ev({ x: 30, y: 5 }, FIELD, { shiftKey: true }), ctx);
    const cursor = (store().draft as { cursor: Point }).cursor;
    expect(cursor.y).toBeCloseTo(second?.y ?? 0);
  });

  it('Escape cancels: no route, no history', () => {
    const before = play();
    start();
    click(routeTool, ev(A));
    expect(routeTool.onKeyDown?.(key('Escape'), ctx)).toBe(true);
    expect(store().draft).toBeNull();
    expect(play()).toBe(before);
    expect(history()).toBe(0);
    expect(routeTool.onKeyDown?.(key('Escape'), ctx)).toBe(false);
  });

  it('Enter with no points drawn clears the draft and adds no route', () => {
    start();
    expect(routeTool.onKeyDown?.(key('Enter'), ctx)).toBe(true);
    expect(store().draft).toBeNull();
    expect(getRoute(play(), 'z')).toBeUndefined();
  });

  it('the QB cannot start a route; the center can', () => {
    click(routeTool, ev({ x: 0, y: -5 }, onPlayer('q')));
    expect(store().draft).toBeNull();
    click(routeTool, ev({ x: 0, y: 0 }, onPlayer('c')));
    expect(store().draft).toMatchObject({ kind: 'route', slotId: 'c' });
  });

  it('pressing the field with no draft does nothing', () => {
    click(routeTool, ev(A));
    expect(store().draft).toBeNull();
  });

  it('onDeactivate clears the draft', () => {
    start();
    click(routeTool, ev(A));
    routeTool.onDeactivate?.(ctx);
    expect(store().draft).toBeNull();
  });

  it('replaces an existing route', () => {
    click(routeTool, ev({ x: -8, y: 0 }, onPlayer('x')));
    click(routeTool, ev({ x: -8, y: 5 }));
    routeTool.onKeyDown?.(key('Enter'), ctx);
    expect(getRoute(play(), 'x')?.path).toEqual([{ x: -8, y: 5 }]);
  });
});
