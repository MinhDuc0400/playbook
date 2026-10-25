import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Play, type PlayerSlot } from '@/domain/types';
import { addPlayer, flip, movePlayer, setMeta, setRoute, toggleProgression } from '@/features/editor/ops';
import { HISTORY_LIMIT, useEditorStore } from '../editorStore';

const slot = (id: string, x: number): PlayerSlot => ({
  id,
  role: 'WR',
  label: id,
  start: { x, y: 0 },
  actions: [],
});

function mkPlay(): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    tags: [],
    players: [slot('a', -8), slot('b', 8)],
    createdAt: 1,
    updatedAt: 2,
  };
}

const store = () => useEditorStore.getState();
const history = () => useEditorStore.temporal.getState();

beforeEach(() => {
  useEditorStore.setState({ tool: 'select', ghostFormationId: null });
  store().load(mkPlay());
});

describe('initial state', () => {
  it('starts empty', () => {
    store().load(null);
    expect(store()).toMatchObject({
      play: null,
      selection: [],
      selectedPoint: null,
      tool: 'select',
      draft: null,
      ghostFormationId: null,
      previewing: false,
    });
    expect(store().canUndo()).toBe(false);
    store().apply('noop', setMeta({ name: 'x' }));
    expect(store().play).toBeNull();
  });
});

describe('apply + undo/redo (FR-ED-04)', () => {
  it('one apply is one undo step; undo and redo restore the play', () => {
    const original = store().play;
    store().apply('rename', setMeta({ name: 'Mesh' }));
    expect(store().play?.name).toBe('Mesh');
    expect(history().pastStates).toHaveLength(1);
    expect(store().canUndo()).toBe(true);
    expect(store().canRedo()).toBe(false);

    store().undo();
    expect(store().play).toBe(original);
    expect(store().canUndo()).toBe(false);
    expect(store().canRedo()).toBe(true);

    store().redo();
    expect(store().play?.name).toBe('Mesh');
    expect(store().canRedo()).toBe(false);
  });

  it('a new apply after undo clears the redo stack', () => {
    store().apply('a', setMeta({ name: 'A' }));
    store().undo();
    store().apply('b', setMeta({ name: 'B' }));
    expect(store().canRedo()).toBe(false);
  });

  it('150 applies then 150 undos restore the original; redo replays them', () => {
    const original = store().play;
    for (let i = 1; i <= 150; i++) store().apply(`n${i}`, setMeta({ name: `v${i}` }));
    expect(history().pastStates).toHaveLength(150);
    for (let i = 0; i < 150; i++) store().undo();
    expect(store().play).toBe(original);
    expect(store().canUndo()).toBe(false);
    for (let i = 0; i < 150; i++) store().redo();
    expect(store().play?.name).toBe('v150');
  });

  it('keeps at most HISTORY_LIMIT steps', () => {
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) store().apply('n', setMeta({ name: `v${i}` }));
    expect(history().pastStates).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) store().undo();
    expect(store().play?.name).toBe('v50');
  });

  it('an unchanged recipe adds no history', () => {
    const p = store().play;
    store().apply('noop', setMeta({ name: 'Test' }));
    store().apply('noop', movePlayer('a', { x: -8, y: 0 }));
    store().apply('noop', movePlayer('nope', { x: 1, y: 1 }));
    expect(store().play).toBe(p);
    expect(history().pastStates).toHaveLength(0);
  });

  it('flip via apply is undoable (FR-FLP-02)', () => {
    const original = store().play;
    store().apply('flip', flip());
    expect(store().play?.players[0]?.start.x).toBe(8);
    store().undo();
    expect(store().play).toBe(original);
  });
});

describe('UI state never creates history', () => {
  it('select / setTool / setSelectedPoint / setDraft / ghost / previewing', () => {
    store().select(['a']);
    store().setTool('route');
    store().setSelectedPoint({ slotId: 'a', index: 0 });
    store().setDraft({ kind: 'generic', data: {} });
    store().setGhostFormation('trips');
    store().setPreviewing(true);
    expect(history().pastStates).toHaveLength(0);
    expect(store().canUndo()).toBe(false);
    expect(store()).toMatchObject({
      selection: ['a'],
      tool: 'route',
      selectedPoint: { slotId: 'a', index: 0 },
      draft: { kind: 'generic', data: {} },
      ghostFormationId: 'trips',
      previewing: true,
    });
  });

  it('undo does not revert selection or tool', () => {
    store().apply('rename', setMeta({ name: 'X' }));
    store().select(['a']);
    store().setTool('place');
    store().undo();
    expect(store().selection).toEqual(['a']);
    expect(store().tool).toBe('place');
  });
});

describe('gestures', () => {
  it('30 moves inside a gesture are one undo step', () => {
    const original = store().play;
    store().beginGesture();
    for (let i = 1; i <= 30; i++) store().apply('drag', movePlayer('a', { x: -8 + i * 0.5, y: i }));
    expect(history().pastStates).toHaveLength(0);
    expect(store().play?.players[0]?.start).toEqual({ x: 7, y: 30 }); // live during the drag
    store().endGesture();
    expect(history().pastStates).toHaveLength(1);
    expect(store().play?.players[0]?.start).toEqual({ x: 7, y: 30 });

    store().undo();
    expect(store().play).toBe(original);
    store().redo();
    expect(store().play?.players[0]?.start).toEqual({ x: 7, y: 30 });
  });

  it('a gesture without changes adds no history and resumes tracking', () => {
    store().beginGesture();
    store().endGesture();
    expect(history().pastStates).toHaveLength(0);
    store().apply('rename', setMeta({ name: 'Z' }));
    expect(history().pastStates).toHaveLength(1);
  });

  it('nested begin and duplicate end are no-ops', () => {
    const original = store().play;
    store().beginGesture();
    store().apply('m', movePlayer('a', { x: -7, y: 0 }));
    store().beginGesture(); // must not re-base on the moved play
    store().apply('m', movePlayer('a', { x: -6, y: 0 }));
    store().endGesture();
    store().endGesture();
    expect(history().pastStates).toHaveLength(1);
    store().undo();
    expect(store().play).toBe(original);
  });

  it('tracking resumes after the gesture', () => {
    store().beginGesture();
    store().apply('m', movePlayer('a', { x: -7, y: 0 }));
    store().endGesture();
    store().apply('rename', setMeta({ name: 'After' }));
    expect(history().pastStates).toHaveLength(2);
  });

  it('beginGesture without a play does nothing', () => {
    store().load(null);
    store().beginGesture();
    store().load(mkPlay());
    store().apply('rename', setMeta({ name: 'ok' }));
    expect(history().pastStates).toHaveLength(1);
  });
});

describe('load', () => {
  it('clears history, selection, selected point, draft and previewing; keeps tool', () => {
    store().apply('rename', setMeta({ name: 'X' }));
    store().select(['a']);
    store().setTool('route');
    store().setDraft({ kind: 'man', slotId: 'a' });
    store().setPreviewing(true);
    store().undo();
    expect(store().canRedo()).toBe(true);

    const next = { ...mkPlay(), id: 'p2' };
    store().load(next);
    expect(store().play).toBe(next);
    expect(store().canUndo()).toBe(false);
    expect(store().canRedo()).toBe(false);
    expect(history().pastStates).toHaveLength(0);
    expect(store().selection).toEqual([]);
    expect(store().selectedPoint).toBeNull();
    expect(store().draft).toBeNull();
    expect(store().previewing).toBe(false);
    expect(store().tool).toBe('route');
  });

  it('abandons a gesture in progress', () => {
    store().beginGesture();
    store().apply('m', movePlayer('a', { x: -7, y: 0 }));
    store().load(mkPlay());
    store().endGesture();
    store().apply('rename', setMeta({ name: 'N' }));
    expect(history().pastStates).toHaveLength(1);
  });
});

describe('selection pruning', () => {
  it('undo drops selected ids that no longer exist', () => {
    let n = 0;
    store().apply(
      'add',
      addPlayer('WR', { x: 3, y: 0 }, 5, () => `new${++n}`),
    );
    store().select(['a', 'new1']);
    store().undo();
    expect(store().selection).toEqual(['a']);
    store().redo();
    expect(store().selection).toEqual(['a']); // redo does not re-select
  });

  it('undo clears a selected route point whose route is gone', () => {
    store().apply('route', setRoute('a', { type: 'route', path: [{ x: -8, y: 5 }], endBehavior: 'stop' }));
    store().setSelectedPoint({ slotId: 'a', index: 0 });
    store().undo();
    expect(store().selectedPoint).toBeNull();
  });

  it('apply drops ids of removed players from the selection', () => {
    store().select(['a', 'b']);
    store().apply('remove', (p) => ({ ...p, players: p.players.filter((s) => s.id !== 'a') }));
    expect(store().selection).toEqual(['b']);
  });
});

describe('integration with ops', () => {
  it('progression clicks and undo', () => {
    store().apply('read', toggleProgression('a'));
    store().apply('read', toggleProgression('b'));
    expect(store().play?.progression).toEqual(['a', 'b']);
    store().undo();
    expect(store().play?.progression).toEqual(['a']);
  });
});
