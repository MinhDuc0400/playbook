import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { Play, PlayerSlot } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import type { FieldPointerEvent, HitTarget, ToolContext } from '../../tools/types';
import { manTool } from '../../tools/manTool';
import { mkPlay, slot } from '../../__tests__/fixtures';

const field = createDefaultFields()['5v5'];
const ctx: ToolContext = {
  getState: useEditorStore.getState,
  field,
  ballSpot: DEFAULT_BALL_SPOT,
  maxPlayers: field.playersPerSide,
  idGen: () => 'id',
};
const store = () => useEditorStore.getState();
const history = () => useEditorStore.temporal.getState().pastStates.length;
const FIELD: HitTarget = { kind: 'field' };

function ev(target: HitTarget, extra: Partial<FieldPointerEvent> = {}): FieldPointerEvent {
  const point = { x: 0, y: 0 };
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
const down = (target: HitTarget) => manTool.onPointerDown?.(ev(target), ctx);
const onDefender = (slotId: string): HitTarget => ({ kind: 'player', slotId });
const onGhost = (label: string): HitTarget => ({ kind: 'ghost', ghostId: `ghost-${label}` });
const key = (k: string) => manTool.onKeyDown?.(new KeyboardEvent('keydown', { key: k }), ctx);

const defensePlay = (): Play =>
  mkPlay(
    [
      slot('cb1', 'CB', { x: 11, y: 5 }, [], 'CB1'),
      slot('cb2', 'CB', { x: -11, y: 5 }, [], 'CB2'),
      slot('lb', 'LB', { x: 5, y: 4 }, [], 'LB'),
      slot('fs', 'S', { x: 0, y: 12 }, [], 'FS'),
      slot('r1', 'R', { x: 0, y: 7 }, [], 'R1'),
    ],
    { side: 'defense', formation: 'Cover 1' },
  );

const getSlot = (id: string): PlayerSlot => {
  const s = store().play?.players.find((p) => p.id === id);
  if (!s) throw new Error(`no slot ${id}`);
  return s;
};
const assign = (slotId: string, ghost: string) => {
  down(onDefender(slotId));
  down(onGhost(ghost));
};

beforeEach(() => {
  store().load(defensePlay());
  store().setGhostFormation(null);
  store().setTool('man');
});

describe('manTool (FR-DEF-02)', () => {
  it('has id man and key m', () => {
    expect(manTool.id).toBe('man');
    expect(manTool.key).toBe('m');
  });

  it('pressing a defender starts a man draft and selects it', () => {
    down(onDefender('cb1'));
    expect(store().draft).toEqual({ kind: 'man', slotId: 'cb1' });
    expect(store().selection).toEqual(['cb1']);
  });

  it('CB then ghost Z (2x1) stores strong #1 with trail technique', () => {
    assign('cb1', 'Z');
    expect(getSlot('cb1').actions).toEqual([
      { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' },
    ]);
    expect(store().draft).toBeNull();
  });

  it('ghost X is weak #1, ghost C is strong #3, ghost Y is strong #2', () => {
    assign('cb2', 'X');
    assign('lb', 'C');
    assign('fs', 'Y');
    expect(getSlot('cb2').actions[0]).toMatchObject({ target: { kind: 'number', side: 'weak', number: 1 } });
    expect(getSlot('lb').actions[0]).toMatchObject({ target: { kind: 'number', side: 'strong', number: 3 } });
    expect(getSlot('fs').actions[0]).toMatchObject({ target: { kind: 'number', side: 'strong', number: 2 } });
  });

  it('clicking the QB ghost stores a role ref', () => {
    assign('lb', 'Q');
    expect(getSlot('lb').actions).toEqual([
      { type: 'man', target: { kind: 'role', role: 'QB' }, technique: 'trail' },
    ]);
  });

  it('with a Trips ghost, Y is strong #2', () => {
    store().setGhostFormation('5v5-off-trips');
    assign('cb1', 'Y');
    expect(getSlot('cb1').actions[0]).toMatchObject({
      target: { kind: 'number', side: 'strong', number: 2 },
    });
  });

  it('keeps the existing technique and cushion when re-assigning', () => {
    assign('cb1', 'Z');
    store().apply('t', (p) => ({
      ...p,
      players: p.players.map((s) =>
        s.id === 'cb1'
          ? {
              ...s,
              actions: [
                {
                  type: 'man',
                  target: { kind: 'number', side: 'strong', number: 1 },
                  technique: 'cushion',
                  cushion: 8,
                },
              ],
            }
          : s,
      ),
    }));
    assign('cb1', 'X');
    expect(getSlot('cb1').actions).toEqual([
      { type: 'man', target: { kind: 'number', side: 'weak', number: 1 }, technique: 'cushion', cushion: 8 },
    ]);
  });

  it('records one undo step per assignment', () => {
    const before = history();
    assign('cb1', 'Z');
    expect(history()).toBe(before + 1);
    assign('cb2', 'X');
    expect(history()).toBe(before + 2);
    store().undo();
    expect(getSlot('cb2').actions).toEqual([]);
    expect(getSlot('cb1').actions).toHaveLength(1);
  });

  it('ignores a ghost press without a draft, and a ghost without a ref', () => {
    down(onGhost('Z'));
    expect(getSlot('cb1').actions).toEqual([]);
    down(onDefender('cb1'));
    down({ kind: 'ghost', ghostId: 'ghost-nobody' });
    expect(getSlot('cb1').actions).toEqual([]);
    expect(store().draft).toEqual({ kind: 'man', slotId: 'cb1' });
  });

  it('pressing another defender switches the draft', () => {
    down(onDefender('cb1'));
    down(onDefender('cb2'));
    expect(store().draft).toEqual({ kind: 'man', slotId: 'cb2' });
    down(onGhost('Z'));
    expect(getSlot('cb1').actions).toEqual([]);
    expect(getSlot('cb2').actions).toHaveLength(1);
  });

  it('Escape cancels the draft (handled); with no draft it is not handled', () => {
    expect(key('Escape')).toBe(false);
    down(onDefender('cb1'));
    expect(key('Escape')).toBe(true);
    expect(store().draft).toBeNull();
    down(onGhost('Z'));
    expect(getSlot('cb1').actions).toEqual([]);
  });

  it('a field press cancels the draft; onDeactivate clears it', () => {
    down(onDefender('cb1'));
    down(FIELD);
    expect(store().draft).toBeNull();
    down(onDefender('cb1'));
    manTool.onDeactivate?.(ctx);
    expect(store().draft).toBeNull();
  });

  it('ignores non-primary buttons and offense plays', () => {
    manTool.onPointerDown?.(ev(onDefender('cb1'), { button: 2 }), ctx);
    expect(store().draft).toBeNull();
    store().load(mkPlay([slot('x', 'WR', { x: -8, y: 0 }, [], 'X')]));
    down(onDefender('x'));
    expect(store().draft).toBeNull();
  });
});
