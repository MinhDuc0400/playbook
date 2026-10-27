import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formationsFor } from '@/domain/formations';
import { SCHEMA_VERSION, ZONE_PRESET_IDS, type Play, type PlayerSlot, type Point } from '@/domain/types';
import { zonePreset } from '@/domain/zones';
import { createDefaultFields } from '@/domain/field';
import { setFeatureOverride } from '@/config/features';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';

vi.mock('@/db/hooks', () => ({ useSettings: vi.fn(() => undefined) }));

import { DefensePanel } from '../DefensePanel';

const FIELD = createDefaultFields()['5v5'];

function slot(
  id: string,
  role: PlayerSlot['role'],
  start: Point,
  actions: PlayerSlot['actions'] = [],
  extra: Partial<PlayerSlot> = {},
): PlayerSlot {
  return { id, role, label: id.toUpperCase(), start, actions, ...extra };
}

function defense(): Play {
  return {
    id: 'd1',
    schemaVersion: SCHEMA_VERSION,
    name: 'D',
    side: 'defense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    alignTo: 'ball',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players: [
      slot(
        'cb1',
        'CB',
        { x: 11, y: 5 },
        [{ type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' }],
        { leverage: 'head-up' },
      ),
      slot('cb2', 'CB', { x: -11, y: 5 }, [
        { type: 'man', target: { kind: 'number', side: 'weak', number: 1 }, technique: 'trail' },
      ]),
      slot('lb', 'LB', { x: 5, y: 4 }, [
        { type: 'zone', zone: 'hook-R', dropPoint: zonePreset('hook-R', FIELD).dropPoint },
      ]),
      slot('fs', 'S', { x: 0, y: 12 }, [
        {
          type: 'zone',
          zone: {
            polygon: [
              { x: -3, y: 10 },
              { x: 3, y: 10 },
              { x: 0, y: 20 },
            ],
          },
          dropPoint: { x: 0, y: 14 },
        },
      ]),
      slot('r1', 'R', { x: 0, y: 7 }),
    ],
  };
}

const store = () => useEditorStore.getState();
const play = (): Play => {
  const p = store().play;
  if (!p) throw new Error('no play');
  return p;
};
const slotOf = (id: string): PlayerSlot => {
  const s = play().players.find((p) => p.id === id);
  if (!s) throw new Error(`no slot ${id}`);
  return s;
};

function setup(selected: string[] = []): void {
  act(() => {
    store().load(defense());
    store().setGhostFormation(null);
    store().select(selected);
  });
  render(<DefensePanel />);
}

describe('DefensePanel (T2.4)', () => {
  beforeEach(() => {
    act(() => store().load(null));
  });

  it('renders nothing for an offense play or no play', () => {
    const { container } = render(<DefensePanel />);
    expect(container).toBeEmptyDOMElement();
    act(() => store().load({ ...defense(), side: 'offense' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a hint when no single defender is selected', () => {
    setup(['cb1', 'cb2']);
    expect(screen.getByText(t.defense.defender.empty)).toBeInTheDocument();
    expect(screen.queryByTestId('def-label')).toBeNull();
    expect(screen.getByTestId('ghost-formation')).toBeInTheDocument();
  });

  it('FR-DEF-01 ghost select lists 5v5 offense formations; Trips sets ghost id and strength (one undo step)', () => {
    setup();
    const select = screen.getByTestId('ghost-formation') as HTMLSelectElement;
    const names = Array.from(select.options).map((o) => o.textContent);
    expect(names).toEqual(formationsFor('offense', '5v5').map((f) => f.name));
    expect(select.value).toBe('5v5-off-2x1');

    // start from a different strength so the change is visible
    act(() => store().apply('prep', (p) => ({ ...p, strength: 'left' })));
    const before = useEditorStore.temporal.getState().pastStates.length;
    fireEvent.change(select, { target: { value: '5v5-off-trips' } });
    expect(store().ghostFormationId).toBe('5v5-off-trips');
    expect(play().strength).toBe('right');
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before + 1);
    act(() => store().undo());
    expect(play().strength).toBe('left');
  });

  it('FR-DEF-06 alignTo select updates the play', () => {
    setup();
    fireEvent.change(screen.getByTestId('def-align-to'), { target: { value: 'strength' } });
    expect(play().alignTo).toBe('strength');
    fireEvent.change(screen.getByTestId('def-align-to'), { target: { value: 'ball' } });
    expect(play().alignTo).toBe('ball');
  });

  it('FR-DEF-02 man defender shows its target and switches technique to cushion with default 5', () => {
    setup(['cb1']);
    expect(screen.getByTestId('def-man-target')).toHaveTextContent('Strong #1');
    expect(screen.queryByTestId('def-cushion')).toBeNull();

    fireEvent.change(screen.getByTestId('def-technique'), { target: { value: 'cushion' } });
    expect(slotOf('cb1').actions[0]).toMatchObject({ type: 'man', technique: 'cushion', cushion: 5 });
    expect(screen.getByTestId('def-cushion')).toHaveValue(5);

    fireEvent.change(screen.getByTestId('def-cushion'), { target: { value: '7.5' } });
    expect(slotOf('cb1').actions[0]).toMatchObject({ cushion: 7.5 });
    // out of range / empty values are not applied
    fireEvent.change(screen.getByTestId('def-cushion'), { target: { value: '20' } });
    fireEvent.change(screen.getByTestId('def-cushion'), { target: { value: '' } });
    expect(slotOf('cb1').actions[0]).toMatchObject({ cushion: 7.5 });

    fireEvent.change(screen.getByTestId('def-technique'), { target: { value: 'trail' } });
    expect(slotOf('cb1').actions[0]).toMatchObject({ technique: 'trail' });
    expect(screen.queryByTestId('def-cushion')).toBeNull();
  });

  it('shows weak targets as "Weak #n"', () => {
    setup(['cb2']);
    expect(screen.getByTestId('def-man-target')).toHaveTextContent('Weak #1');
  });

  it('FR-DEF-05 leverage select updates and clears', () => {
    setup(['cb1']);
    const sel = screen.getByTestId('def-leverage');
    expect(sel).toHaveValue('head-up');
    fireEvent.change(sel, { target: { value: 'inside' } });
    expect(slotOf('cb1').leverage).toBe('inside');
    fireEvent.change(sel, { target: { value: 'none' } });
    expect(slotOf('cb1').leverage).toBeUndefined();
  });

  it('FR-DEF-05 "Tự căn" moves the defender: strong #1 inside cushion 5 vs 2x1 ghost', () => {
    setup(['cb1']);
    fireEvent.change(screen.getByTestId('def-leverage'), { target: { value: 'inside' } });
    fireEvent.change(screen.getByTestId('def-technique'), { target: { value: 'cushion' } });
    fireEvent.click(screen.getByTestId('btn-auto-align'));
    expect(slotOf('cb1').start).toEqual({ x: 11, y: 4 });
    // other defenders untouched
    expect(slotOf('cb2').start).toEqual({ x: -11, y: 5 });
  });

  it('FR-DEF-03 zone preset select changes the zone and its default drop point', () => {
    setup(['lb']);
    const sel = screen.getByTestId('def-zone-preset') as HTMLSelectElement;
    expect(sel.value).toBe('hook-R');
    expect(Array.from(sel.options).filter((o) => o.value !== 'custom')).toHaveLength(ZONE_PRESET_IDS.length);
    fireEvent.change(sel, { target: { value: 'flat-R' } });
    expect(slotOf('lb').actions[0]).toEqual({
      type: 'zone',
      zone: 'flat-R',
      dropPoint: zonePreset('flat-R', FIELD).dropPoint,
    });
    expect(screen.queryByTestId('def-make-zone')).toBeNull();
  });

  it('custom polygon zone shows the disabled custom option', () => {
    setup(['fs']);
    const sel = screen.getByTestId('def-zone-preset') as HTMLSelectElement;
    expect(sel.value).toBe('custom');
    const custom = Array.from(sel.options).find((o) => o.value === 'custom');
    expect(custom).toBeDisabled();
    expect(custom).toHaveTextContent(t.defense.zone.custom);
  });

  it('"Chuyển sang zone" turns a man defender into the hook zone of its side', () => {
    setup(['cb2']);
    fireEvent.click(screen.getByTestId('def-make-zone'));
    expect(slotOf('cb2').actions[0]).toMatchObject({ type: 'zone', zone: 'hook-L' });
    expect(screen.getByTestId('def-zone-preset')).toHaveValue('hook-L');
    expect(screen.queryByTestId('def-man-target')).toBeNull();
  });

  it('FR-DEF-04 rusher toggle sets role R with a rush, again clears it; count warns above max', () => {
    const base = defense();
    act(() => {
      store().load({
        ...base,
        players: base.players.map((p) =>
          p.id === 'r1' ? { ...p, actions: [{ type: 'rush', path: [{ x: 0, y: -5 }], delay: 0 }] } : p,
        ),
      });
      store().select(['lb']);
    });
    render(<DefensePanel />);
    expect(screen.getByTestId('def-rusher-count')).toHaveTextContent('1 / 2');

    fireEvent.click(screen.getByTestId('def-rush-toggle'));
    expect(slotOf('lb').role).toBe('R');
    expect(slotOf('lb').actions.map((a) => a.type)).toEqual(['rush']);
    expect(screen.getByTestId('def-rush-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('def-rusher-count')).toHaveTextContent('2 / 2');
    expect(screen.getByTestId('def-rusher-count')).toHaveAttribute('data-over', 'false');

    act(() => store().select(['cb1']));
    fireEvent.click(screen.getByTestId('def-rush-toggle'));
    expect(screen.getByTestId('def-rusher-count')).toHaveTextContent('3 / 2');
    expect(screen.getByTestId('def-rusher-count')).toHaveAttribute('data-over', 'true');

    fireEvent.click(screen.getByTestId('def-rush-toggle'));
    expect(slotOf('cb1').role).toBe('LB');
    expect(slotOf('cb1').actions).toEqual([]);
    expect(screen.getByTestId('def-rusher-count')).toHaveTextContent('2 / 2');
  });

  it('"Xóa assignment" clears the coverage', () => {
    setup(['cb1']);
    fireEvent.click(screen.getByTestId('def-clear'));
    expect(slotOf('cb1').actions).toEqual([]);
    expect(screen.getByTestId('def-clear')).toBeDisabled();
  });

  it('label input renames the defender', () => {
    setup(['cb1']);
    fireEvent.change(screen.getByTestId('def-label'), { target: { value: 'CBx' } });
    expect(slotOf('cb1').label).toBe('CBx');
  });

  it('"Tự căn tất cả" aligns every man defender, leaves zones alone', () => {
    setup();
    act(() => {
      store().apply('lev', (p) => ({
        ...p,
        players: p.players.map((s) => (s.id === 'cb1' ? { ...s, leverage: 'inside' as const } : s)),
      }));
    });
    fireEvent.click(screen.getByTestId('btn-auto-align-all'));
    expect(slotOf('cb1').start.x).toBe(11);
    expect(slotOf('cb2').start.y).toBeLessThan(5);
    expect(slotOf('lb').start).toEqual({ x: 5, y: 4 });
    expect(slotOf('fs').start).toEqual({ x: 0, y: 12 });
  });

  it('FR-DEF-07 shows the match-rules form for a selected defender only', () => {
    setup(['cb1']);
    expect(screen.getByTestId('rules-list')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rule-add'));
    expect(play().players.find((p) => p.id === 'cb1')?.matchRules).toHaveLength(1);
  });

  it('FR-DEF-07 hides the match-rules form without a single selection', () => {
    setup();
    expect(screen.queryByTestId('rules-list')).toBeNull();
  });
});

describe('DefensePanel Simple mode (T11.4, D-26)', () => {
  beforeEach(() => {
    act(() => store().load(null));
  });
  afterEach(() => setFeatureOverride(true));

  it('hides alignTo; keeps auto align, leverage and match rules', () => {
    setFeatureOverride(false);
    setup(['cb1']);
    expect(screen.queryByTestId('def-align-to')).toBeNull();
    for (const id of ['btn-auto-align-all', 'def-leverage', 'rule-add']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('Advanced shows alignTo', () => {
    setFeatureOverride(true);
    setup(['cb1']);
    expect(screen.getByTestId('def-align-to')).toBeInTheDocument();
  });
});
