import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { createPlay } from '@/domain/formations';
import type { Play, PlayerSlot, Point, RushAction, ZoneAction } from '@/domain/types';
import { polygonCentroid } from '@/domain/geometry';
import { useEditorStore } from '@/store/editorStore';
import { rushTool } from '../../tools/rushTool';
import { zoneTool } from '../../tools/zoneTool';
import type { EditorTool, FieldPointerEvent, HitTarget, ToolContext } from '../../tools/types';
import { setZone } from '../ops';

const field = createDefaultFields()['5v5'];
const ctx: ToolContext = {
  getState: useEditorStore.getState,
  field,
  ballSpot: DEFAULT_BALL_SPOT,
  maxPlayers: field.playersPerSide,
  idGen: () => 'x',
};

const store = () => useEditorStore.getState();
const play = (): Play => {
  const p = store().play;
  if (!p) throw new Error('no play');
  return p;
};
const history = () => useEditorStore.temporal.getState().pastStates.length;
const FIELD: HitTarget = { kind: 'field' };
const key = (k: string) => new KeyboardEvent('keydown', { key: k });

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
function click(tool: EditorTool, e: FieldPointerEvent): void {
  tool.onPointerDown?.(e, ctx);
  tool.onPointerUp?.(e, ctx);
}
const slotByLabel = (label: string): PlayerSlot => {
  const s = play().players.find((p) => p.label === label);
  if (!s) throw new Error(`no ${label}`);
  return s;
};
const zoneOf = (label: string) => slotByLabel(label).actions.find((a): a is ZoneAction => a.type === 'zone');
const rushOf = (label: string) => slotByLabel(label).actions.find((a): a is RushAction => a.type === 'rush');

beforeEach(() => {
  let n = 0;
  store().load(
    createPlay({
      side: 'defense',
      format: '5v5',
      formationId: '5v5-def-cover-3',
      now: 1,
      idGen: () => `id${++n}`,
    }),
  );
  store().setTool('zone');
});

describe('zoneTool (FR-DEF-03)', () => {
  const square: Point[] = [
    { x: -6, y: 12 },
    { x: 6, y: 12 },
    { x: 6, y: 22 },
    { x: -6, y: 22 },
  ];

  function selectFs(): string {
    const fs = slotByLabel('FS').id;
    click(zoneTool, ev({ x: 0, y: 11 }, { kind: 'player', slotId: fs }));
    return fs;
  }

  it('selects a defender on pointerdown without starting a draft', () => {
    const fs = selectFs();
    expect(store().selection).toEqual([fs]);
    expect(store().draft).toBeNull();
  });

  it('4 field clicks + Enter makes a custom polygon zone with the centroid drop point', () => {
    selectFs();
    for (const p of square) click(zoneTool, ev(p));
    expect(store().draft).toMatchObject({ kind: 'polygon', points: square });
    expect(zoneTool.onKeyDown?.(key('Enter'), ctx)).toBe(true);
    const zone = zoneOf('FS');
    expect(zone?.zone).toEqual({ polygon: square });
    expect(zone?.dropPoint).toEqual(polygonCentroid(square));
    expect(store().draft).toBeNull();
    expect(history()).toBe(1);
  });

  it('pointer move updates the draft cursor', () => {
    selectFs();
    click(zoneTool, ev(square[0] as Point));
    zoneTool.onPointerMove?.(ev({ x: 3, y: 4 }), ctx);
    expect(store().draft).toMatchObject({ kind: 'polygon', cursor: { x: 3, y: 4 } });
  });

  it('double-click finishes with at least 3 points and does not duplicate the last vertex', () => {
    selectFs();
    for (const p of square.slice(0, 3)) click(zoneTool, ev(p));
    zoneTool.onPointerDown?.(ev(square[2] as Point, FIELD, { detail: 2 }), ctx);
    zoneTool.onDoubleClick?.(ev(square[2] as Point, FIELD, { detail: 2 }), ctx);
    expect(zoneOf('FS')?.zone).toEqual({ polygon: square.slice(0, 3) });
  });

  it('Esc cancels the draft without changing the play', () => {
    selectFs();
    for (const p of square) click(zoneTool, ev(p));
    const before = play();
    expect(zoneTool.onKeyDown?.(key('Escape'), ctx)).toBe(true);
    expect(store().draft).toBeNull();
    expect(play()).toBe(before);
    expect(zoneTool.onKeyDown?.(key('Escape'), ctx)).toBe(false);
  });

  it('Enter with fewer than 3 points does nothing', () => {
    selectFs();
    click(zoneTool, ev(square[0] as Point));
    click(zoneTool, ev(square[1] as Point));
    const before = play();
    zoneTool.onKeyDown?.(key('Enter'), ctx);
    zoneTool.onDoubleClick?.(ev(square[1] as Point), ctx);
    expect(play()).toBe(before);
    expect(store().draft).toMatchObject({ kind: 'polygon' });
  });

  it('field clicks without exactly one selected defender draw nothing', () => {
    click(zoneTool, ev({ x: 1, y: 1 }));
    expect(store().draft).toBeNull();
    store().select([slotByLabel('FS').id, slotByLabel('LB').id]);
    click(zoneTool, ev({ x: 1, y: 1 }));
    expect(store().draft).toBeNull();
  });

  it('selecting another defender drops a polygon draft; deactivating clears it', () => {
    selectFs();
    click(zoneTool, ev(square[0] as Point));
    click(zoneTool, ev({ x: 0, y: 5 }, { kind: 'player', slotId: slotByLabel('LB').id }));
    expect(store().draft).toBeNull();
    selectFs();
    click(zoneTool, ev(square[0] as Point));
    zoneTool.onDeactivate?.(ctx);
    expect(store().draft).toBeNull();
  });

  it('dragging the drop point is one undo step', () => {
    const fs = slotByLabel('FS').id;
    store().apply('zone', setZone(fs, 'deep-third-M', field));
    const base = history();
    const handle: HitTarget = { kind: 'dropPoint', slotId: fs };
    zoneTool.onPointerDown?.(ev({ x: 0, y: 16 }, handle), ctx);
    zoneTool.onPointerMove?.(ev({ x: 1, y: 17 }), ctx);
    zoneTool.onPointerMove?.(ev({ x: 2, y: 18 }), ctx);
    zoneTool.onPointerUp?.(ev({ x: 2, y: 18 }), ctx);
    expect(zoneOf('FS')?.dropPoint).toEqual({ x: 2, y: 18 });
    expect(zoneOf('FS')?.zone).toBe('deep-third-M');
    expect(history()).toBe(base + 1);
    expect(store().draft).toBeNull();
    store().undo();
    expect(zoneOf('FS')?.dropPoint).toEqual({ x: 0, y: 16 });
  });
});

describe('rushTool (FR-DEF-04)', () => {
  beforeEach(() => store().setTool('rush'));

  it('clicking a CB makes it a rusher to (0,-5); clicking again clears it', () => {
    const cb = slotByLabel('CB1').id;
    click(rushTool, ev({ x: 12, y: 6 }, { kind: 'player', slotId: cb }));
    expect(slotByLabel('CB1').role).toBe('R');
    expect(rushOf('CB1')?.path).toEqual([{ x: 0, y: -5 }]);
    expect(store().selection).toEqual([cb]);
    expect(history()).toBe(1);
    click(rushTool, ev({ x: 12, y: 6 }, { kind: 'player', slotId: cb }));
    expect(slotByLabel('CB1').role).toBe('LB');
    expect(rushOf('CB1')).toBeUndefined();
    expect(history()).toBe(2);
  });

  it('allows a third rusher', () => {
    click(rushTool, ev({ x: 12, y: 6 }, { kind: 'player', slotId: slotByLabel('CB1').id }));
    click(rushTool, ev({ x: -12, y: 6 }, { kind: 'player', slotId: slotByLabel('CB2').id }));
    expect(play().players.filter((s) => s.role === 'R')).toHaveLength(3);
  });

  it('dragging a rush path point updates the path in one undo step', () => {
    const r1 = slotByLabel('R1').id;
    const base = history();
    const handle: HitTarget = { kind: 'routePoint', slotId: r1, index: 0 };
    rushTool.onPointerDown?.(ev({ x: 0, y: -5 }, handle), ctx);
    rushTool.onPointerMove?.(ev({ x: 1, y: -4 }), ctx);
    rushTool.onPointerMove?.(ev({ x: 2, y: -3 }), ctx);
    rushTool.onPointerUp?.(ev({ x: 2, y: -3 }), ctx);
    expect(rushOf('R1')?.path).toEqual([{ x: 2, y: -3 }]);
    expect(history()).toBe(base + 1);
    expect(store().draft).toBeNull();
    store().undo();
    expect(rushOf('R1')?.path).toEqual([{ x: 0, y: -5 }]);
  });

  it('double-click on a rush segment inserts a point', () => {
    const r1 = slotByLabel('R1').id;
    rushTool.onDoubleClick?.(ev({ x: 0, y: 1 }, { kind: 'routeSegment', slotId: r1, index: 0 }), ctx);
    expect(rushOf('R1')?.path).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: -5 },
    ]);
  });

  it('ignores route points of players without a rush and non-defense plays', () => {
    const cb = slotByLabel('CB1').id;
    rushTool.onPointerDown?.(ev({ x: 0, y: 0 }, { kind: 'routePoint', slotId: cb, index: 0 }), ctx);
    expect(store().draft).toBeNull();
  });
});
