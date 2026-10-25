import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTE_TEMPLATES } from '@/domain/routeTree';
import { SCHEMA_VERSION, type Play, type PlayerSlot, type Point } from '@/domain/types';
import { getRoute } from '@/features/editor/ops';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { OffensePanel } from '../OffensePanel';

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
