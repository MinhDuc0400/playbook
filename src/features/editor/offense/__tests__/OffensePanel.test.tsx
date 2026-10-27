import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTE_TEMPLATES } from '@/domain/routeTree';
import { SCHEMA_VERSION, type Play, type PlayerSlot, type Point } from '@/domain/types';
import { getMotion, getRoute, setMotion, setOptionRoute } from '@/features/editor/ops';
import { setFeatureOverride } from '@/config/features';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { OffensePanel } from '../OffensePanel';

vi.mock('@/engine/readModel', () => ({
  readOrder: (
    mode: string,
    progression: string[],
    receivers: { id: string; pos: { x: number } }[],
  ): string[] => {
    const byX = [...receivers].sort((a, b) => a.pos.x - b.pos.x).map((r) => r.id);
    if (mode === 'rightToLeft') return byX.reverse();
    if (mode === 'leftToRight') return byX;
    return progression;
  },
}));

function slot(
  id: string,
  role: PlayerSlot['role'],
  start: Point,
  label: string,
  actions: PlayerSlot['actions'] = [],
): PlayerSlot {
  return { id, role, label, start, actions };
}

/** QB, C, X left, Z + Y right: 2 right vs 1 left => auto strength right. */
function offense(): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    strengthOverridden: false,
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players: [
      slot('q', 'QB', { x: 0, y: -5 }, 'Q', [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]),
      slot('c', 'C', { x: 0, y: 0 }, 'C'),
      slot('x', 'WR', { x: -8, y: 0 }, 'X'),
      slot('z', 'WR', { x: 8, y: 0 }, 'Z'),
      slot('y', 'WR', { x: 4, y: 0 }, 'Y'),
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
    store().load(offense());
    store().select(selected);
  });
  render(<OffensePanel />);
}

describe('OffensePanel (T1.10)', () => {
  beforeEach(() => {
    act(() => store().load(null));
  });

  it('renders nothing for a defense play or no play', () => {
    const { container } = render(<OffensePanel />);
    expect(container).toBeEmptyDOMElement();
    act(() => store().load({ ...offense(), side: 'defense' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a hint instead of player controls when nothing (or several) is selected', () => {
    setup(['x', 'z']);
    expect(screen.getByText(t.offense.player.empty)).toBeInTheDocument();
    expect(screen.queryByTestId('player-label')).toBeNull();
    expect(screen.getByTestId('strength-select')).toBeInTheDocument();
  });

  it('FR-OFF-03 slant for a left WR goes inside (x increases); one undo step', () => {
    setup(['x']);
    expect(store().canUndo()).toBe(false);
    fireEvent.click(screen.getByTestId('route-template-slant'));
    const route = getRoute(play(), 'x');
    expect(route?.templateId).toBe('slant');
    const end = route?.path.at(-1);
    expect(end?.x).toBeGreaterThan(-8);
    expect(screen.getByTestId('route-template-slant')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('route-template-hitch')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('route-depth')).toHaveValue(ROUTE_TEMPLATES.slant.defaultDepth);

    act(() => store().undo());
    expect(getRoute(play(), 'x')).toBeUndefined();
  });

  it('FR-OFF-03 slant for a right WR goes inside (x decreases)', () => {
    setup(['z']);
    fireEvent.click(screen.getByTestId('route-template-slant'));
    expect(getRoute(play(), 'z')?.path.at(-1)?.x).toBeLessThan(8);
  });

  it('depth change re-applies the template with the new depth', () => {
    setup(['x']);
    fireEvent.click(screen.getByTestId('route-template-out'));
    const before = getRoute(play(), 'x')?.path;
    const depthInput = screen.getByTestId('route-depth');
    fireEvent.change(depthInput, { target: { value: '8' } });
    const route = getRoute(play(), 'x');
    expect(route?.templateId).toBe('out');
    expect(route?.path).not.toEqual(before);
    expect(route?.path[0]?.y).toBe(8); // out breaks at y = depth
    expect(screen.getByTestId('route-depth')).toHaveValue(8);
  });

  it('depth outside the template range is not applied', () => {
    setup(['x']);
    fireEvent.click(screen.getByTestId('route-template-out'));
    const before = getRoute(play(), 'x');
    fireEvent.change(screen.getByTestId('route-depth'), { target: { value: '99' } });
    expect(getRoute(play(), 'x')).toBe(before);
  });

  it('depth input is disabled until a template route exists', () => {
    setup(['x']);
    expect(screen.getByTestId('route-depth')).toBeDisabled();
    expect(screen.getByTestId('route-end-behavior')).toBeDisabled();
    expect(screen.getByTestId('route-remove')).toBeDisabled();
  });

  it('end behaviour select updates the route', () => {
    setup(['x']);
    fireEvent.click(screen.getByTestId('route-template-hitch')); // template default: stop
    expect(getRoute(play(), 'x')?.endBehavior).toBe('stop');
    fireEvent.change(screen.getByTestId('route-end-behavior'), { target: { value: 'continue' } });
    expect(getRoute(play(), 'x')?.endBehavior).toBe('continue');
  });

  it('"Xóa route" removes the route', () => {
    setup(['x']);
    fireEvent.click(screen.getByTestId('route-template-go'));
    fireEvent.click(screen.getByTestId('route-remove'));
    expect(getRoute(play(), 'x')).toBeUndefined();
    expect(screen.getByTestId('route-template-go')).toHaveAttribute('aria-pressed', 'false');
  });

  it('FR-ED-02 label edit sets the label; blank labels are ignored', () => {
    setup(['x']);
    const input = screen.getByTestId('player-label');
    expect(input).toHaveValue('X');
    fireEvent.change(input, { target: { value: 'W1' } });
    expect(slotOf('x').label).toBe('W1');
    fireEvent.change(input, { target: { value: '  ' } });
    expect(slotOf('x').label).toBe('W1');
  });

  it('FR-OFF-04 QB shows drop controls (no route tree) and updates the qbDrop action', () => {
    setup(['q']);
    expect(screen.queryByTestId('route-template-slant')).toBeNull();
    expect(screen.getByTestId('qb-drop-depth')).toHaveValue(2);
    expect(screen.getByTestId('qb-drop-style')).toHaveValue('shotgun');

    fireEvent.change(screen.getByTestId('qb-drop-depth'), { target: { value: '4.5' } });
    expect(slotOf('q').actions).toContainEqual({ type: 'qbDrop', depth: 4.5, style: 'shotgun' });

    fireEvent.change(screen.getByTestId('qb-drop-style'), { target: { value: 'under' } });
    expect(slotOf('q').actions).toContainEqual({ type: 'qbDrop', depth: 4.5, style: 'under' });

    fireEvent.change(screen.getByTestId('qb-drop-depth'), { target: { value: '30' } });
    expect(slotOf('q').actions).toContainEqual({ type: 'qbDrop', depth: 4.5, style: 'under' });
  });

  it('FR-OFF-04 progression toggles in click order, removes, and clears', () => {
    setup();
    expect(screen.queryByTestId('progression-toggle-Q')).toBeNull(); // QB is not a receiver
    fireEvent.click(screen.getByTestId('progression-toggle-Z'));
    fireEvent.click(screen.getByTestId('progression-toggle-X'));
    expect(play().progression).toEqual(['z', 'x']);
    const items = screen.getByTestId('progression-list').querySelectorAll('li');
    expect(items[0]).toHaveTextContent('1Z');
    expect(items[1]).toHaveTextContent('2X');
    expect(screen.getByTestId('progression-toggle-Z')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('progression-toggle-Y')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('progression-toggle-Z'));
    expect(play().progression).toEqual(['x']);

    fireEvent.click(screen.getByTestId('progression-toggle-Y'));
    expect(play().progression).toEqual(['x', 'y']);
    fireEvent.click(screen.getByTestId('progression-clear'));
    expect(play().progression).toEqual([]);
    expect(screen.getByText(t.offense.progression.empty)).toBeInTheDocument();
  });

  it('FR-OFF-05 strength override and back to auto', () => {
    setup();
    const select = screen.getByTestId('strength-select');
    expect(select).toHaveValue('auto');
    expect(screen.getByRole('option', { name: /Tự động \(Phải\)/ })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'left' } });
    expect(play().strength).toBe('left');
    expect(play().strengthOverridden).toBe(true);
    expect(screen.getByTestId('strength-select')).toHaveValue('left');

    fireEvent.change(screen.getByTestId('strength-select'), { target: { value: 'auto' } });
    expect(play().strength).toBe('right');
    expect(play().strengthOverridden).toBe(false);
    expect(screen.getByTestId('strength-select')).toHaveValue('auto');
  });

  it('every edit is its own undo step', () => {
    setup(['x']);
    expect(store().canUndo()).toBe(false);
    fireEvent.click(screen.getByTestId('route-template-slant'));
    expect(store().canUndo()).toBe(true);
    fireEvent.click(screen.getByTestId('progression-toggle-X'));
    fireEvent.change(screen.getByTestId('strength-select'), { target: { value: 'balanced' } });

    act(() => store().undo());
    expect(play().strength).toBe('right');
    act(() => store().undo());
    expect(play().progression ?? []).toEqual([]);
    act(() => store().undo());
    expect(getRoute(play(), 'x')).toBeUndefined();
    expect(store().canUndo()).toBe(false);
  });
});

describe('OffensePanel timing (T5.6)', () => {
  beforeEach(() => {
    act(() => store().load(null));
  });

  it('delay input sets and clears the route delay', () => {
    setup(['x']);
    fireEvent.click(screen.getByTestId('route-template-slant'));
    fireEvent.change(screen.getByTestId('route-delay'), { target: { value: '0.5' } });
    expect(getRoute(play(), 'x')?.delay).toBe(0.5);
    fireEvent.change(screen.getByTestId('route-delay'), { target: { value: '0' } });
    expect(getRoute(play(), 'x')?.delay).toBeUndefined();
  });

  it('motion duration and removal; option removal', () => {
    setup(['z']);
    expect(screen.getByTestId('motion-duration')).toBeDisabled();
    act(() => store().apply('m', setMotion('z', [{ x: 6, y: 0 }])));
    fireEvent.change(screen.getByTestId('motion-duration'), { target: { value: '2' } });
    expect(getMotion(play(), 'z')?.duration).toBe(2);
    fireEvent.click(screen.getByTestId('motion-remove'));
    expect(getMotion(play(), 'z')).toBeUndefined();

    act(() =>
      store().apply(
        'o',
        setOptionRoute('z', { stem: [{ x: 8, y: 6 }], vsMan: [{ x: 4, y: 9 }], vsZone: [{ x: 12, y: 9 }] }),
      ),
    );
    fireEvent.click(screen.getByTestId('option-remove'));
    expect(slotOf('z').actions).toEqual([]);
  });

  describe('read plan (D-22)', () => {
    const setupProg = (): void => {
      setup([]);
      act(() => {
        store().apply('p', (p) => ({ ...p, progression: ['y', 'x'] }));
      });
    };
    const rowLabels = (): string[] =>
      screen.getAllByTestId(/^read-row-/).map((el) => el.getAttribute('data-testid')?.slice(9) ?? '');

    it('mode select writes the mode; progression clears readPlan; one undo each', () => {
      setupProg();
      fireEvent.change(screen.getByTestId('read-mode'), { target: { value: 'leftToRight' } });
      expect(play().readPlan?.mode).toBe('leftToRight');
      act(() => store().undo());
      expect(play().readPlan).toBeUndefined();
      expect(screen.getByTestId('read-mode')).toHaveValue('progression');
    });

    it('rows follow the progression, then x order for side modes', () => {
      setupProg();
      expect(rowLabels()).toEqual(['Y', 'X']);
      fireEvent.change(screen.getByTestId('read-mode'), { target: { value: 'leftToRight' } });
      expect(rowLabels()).toEqual(['X', 'C', 'Y', 'Z']);
      fireEvent.change(screen.getByTestId('read-mode'), { target: { value: 'rightToLeft' } });
      expect(rowLabels()).toEqual(['Z', 'Y', 'C', 'X']);
    });

    it('unchecking auto stores a default window, editing applies valid values, re-check removes it', () => {
      setupProg();
      fireEvent.click(screen.getByTestId('read-auto-X'));
      expect(play().readPlan?.windows?.x).toEqual({ from: 1.5, to: 2 });
      expect(screen.getByTestId('read-from-X')).toHaveValue(1.5);
      fireEvent.change(screen.getByTestId('read-to-X'), { target: { value: '2.5' } });
      expect(play().readPlan?.windows?.x).toEqual({ from: 1.5, to: 2.5 });
      fireEvent.change(screen.getByTestId('read-to-X'), { target: { value: '1' } });
      expect(play().readPlan?.windows?.x).toEqual({ from: 1.5, to: 2.5 });
      fireEvent.click(screen.getByTestId('read-auto-X'));
      expect(play().readPlan).toBeUndefined();
      expect(screen.queryByTestId('read-from-X')).toBeNull();
    });

    it('min score is stored, ignored when out of range, and cleared when emptied', () => {
      setupProg();
      const input = screen.getByTestId('read-min-Y');
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('55'));
      fireEvent.change(input, { target: { value: '70' } });
      expect(play().readPlan?.minScore?.y).toBe(70);
      fireEvent.change(input, { target: { value: '150' } });
      expect(play().readPlan?.minScore?.y).toBe(70);
      fireEvent.change(input, { target: { value: '' } });
      expect(play().readPlan).toBeUndefined();
    });
  });
});

describe('OffensePanel Simple mode (T11.4, D-26)', () => {
  beforeEach(() => {
    act(() => store().load(null));
  });
  afterEach(() => setFeatureOverride(true));

  it('hides strength, read plan and route end behaviour; keeps route, timing and read order', () => {
    setFeatureOverride(false);
    setup(['x']);
    for (const id of ['strength-select', 'route-end-behavior', 'read-plan', 'read-mode']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    for (const id of ['route-template-slant', 'route-depth', 'route-delay', 'progression-toggle-Z']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('QB keeps drop depth but hides drop style', () => {
    setFeatureOverride(false);
    setup(['q']);
    expect(screen.queryByTestId('qb-drop-style')).toBeNull();
    expect(screen.getByTestId('qb-drop-depth')).toBeInTheDocument();
  });

  it('Advanced shows everything', () => {
    setFeatureOverride(true);
    setup(['q']);
    expect(screen.getByTestId('qb-drop-style')).toBeInTheDocument();
    expect(screen.getByTestId('strength-select')).toBeInTheDocument();
    expect(screen.getByTestId('read-plan')).toBeInTheDocument();
  });
});
