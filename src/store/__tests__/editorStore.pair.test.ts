import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Play } from '@/domain/types';
import { movePlayer, setMeta } from '@/features/editor/ops';
import { useEditorStore } from '../editorStore';

function mk(id: string, side: 'offense' | 'defense'): Play {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: id,
    side,
    format: '5v5',
    formation: 'T',
    strength: 'right',
    tags: [],
    players: [{ id: 'a', role: 'WR', label: 'a', start: { x: 0, y: 0 }, actions: [] }],
    createdAt: 1,
    updatedAt: 2,
  };
}

const s = () => useEditorStore.getState();
let off: Play;
let def: Play;

beforeEach(() => {
  off = mk('o', 'offense');
  def = mk('d', 'defense');
  useEditorStore.setState({ tool: 'select' });
  s().load(null);
});

describe('T-FS-01 companion play', () => {
  it('T-FS-01 default companion is null', () => {
    expect(s().companion).toBeNull();
    s().load(off);
    expect(s().companion).toBeNull();
  });

  it('T-FS-01 load with companion clears history and ui', () => {
    s().load(off);
    s().apply('n', setMeta({ name: 'x' }));
    s().select(['a']);
    s().load(off, def);
    expect(s().play).toBe(off);
    expect(s().companion).toBe(def);
    expect(s().selection).toEqual([]);
    expect(s().canUndo()).toBe(false);
  });

  it('T-FS-01 loadPair picks active side', () => {
    s().loadPair(off, def, 'defense');
    expect(s().play).toBe(def);
    expect(s().companion).toBe(off);
  });

  it('T-FS-01 switchSide swaps, resets ui, is not undoable', () => {
    s().load(off, def);
    s().select(['a']);
    s().setTool('route');
    s().switchSide();
    expect(s().play).toBe(def);
    expect(s().companion).toBe(off);
    expect(s().selection).toEqual([]);
    expect(s().tool).toBe('select');
    expect(s().canUndo()).toBe(false);
    s().switchSide();
    expect(s().play).toBe(off);
  });

  it('T-FS-01 switchSide is a no-op without a companion', () => {
    s().load(off);
    s().switchSide();
    expect(s().play).toBe(off);
    expect(s().companion).toBeNull();
  });

  it('T-FS-01 undo/redo follow the side that was edited', () => {
    s().load(off, def);
    s().apply('o', setMeta({ name: 'O2' }));
    s().switchSide();
    s().apply('d', setMeta({ name: 'D2' }));
    expect(s().play?.name).toBe('D2');

    s().undo();
    expect(s().play?.name).toBe('d');
    expect(s().play?.side).toBe('defense');
    expect(s().companion?.name).toBe('O2');

    s().undo();
    expect(s().play?.side).toBe('offense');
    expect(s().play?.name).toBe('o');
    expect(s().companion).toBe(def);

    s().redo();
    expect(s().play?.name).toBe('d');
    expect(s().play?.side).toBe('defense');
    expect(s().companion?.name).toBe('O2');
    s().redo();
    expect(s().play?.name).toBe('D2');
    expect(s().play?.side).toBe('defense');
    expect(s().companion?.name).toBe('O2');
  });

  it('T-FS-01 gesture drag with a companion is one undo step', () => {
    s().load(off, def);
    s().beginGesture();
    for (let x = 1; x <= 5; x++) s().apply('m', movePlayer('a', { x, y: 0 }));
    s().endGesture();
    expect(s().play?.players[0]?.start.x).toBe(5);
    s().undo();
    expect(s().play).toBe(off);
    expect(s().companion).toBe(def);
    expect(s().canUndo()).toBe(false);
  });

  it('T-FS-01 switchSide is ignored during a gesture', () => {
    s().load(off, def);
    s().beginGesture();
    s().switchSide();
    expect(s().play).toBe(off);
    expect(s().companion).toBe(def);
    s().endGesture();
    s().switchSide();
    expect(s().play).toBe(def);
  });
});
