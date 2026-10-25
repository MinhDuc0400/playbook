import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldContext } from '@/components/field/FieldContext';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { useEditorStore } from '@/store/editorStore';
import { mkPlay, offenseFixture, slot } from '../../__tests__/fixtures';
import { EditorCanvas } from '../../EditorCanvas';
import { GhostLayer } from '../GhostLayer';

const field = createDefaultFields()['5v5'];
const viewport = defaultViewport(800, 600, field, DEFAULT_BALL_SPOT);
const store = () => useEditorStore.getState();

const defensePlay = () =>
  mkPlay(
    [
      slot('cb1', 'CB', { x: 11, y: 5 }, [], 'CB1'),
      slot('cb2', 'CB', { x: -11, y: 5 }, [], 'CB2'),
      slot('r1', 'R', { x: 0, y: 7 }, [], 'R1'),
    ],
    { side: 'defense', formation: 'Cover 1' },
  );

function renderLayer() {
  return render(
    <FieldContext.Provider value={{ viewport, field, ballSpot: DEFAULT_BALL_SPOT }}>
      <svg>
        <GhostLayer />
      </svg>
    </FieldContext.Provider>,
  );
}

beforeEach(() => {
  store().load(defensePlay());
  store().setGhostFormation(null);
  store().setTool('select');
});

afterEach(() => cleanup());

const hits = () => Array.from(document.querySelectorAll('[data-kind="ghost"][data-ghost-id]'));
const badge = (label: string) => screen.getByTestId(`ghost-number-${label}`).textContent;

describe('GhostLayer (FR-DEF-01)', () => {
  it('renders nothing for an offense play', () => {
    store().load(offenseFixture());
    renderLayer();
    expect(screen.queryByTestId('ghost-layer')).toBeNull();
    expect(document.querySelector('[data-kind="ghost"]')).toBeNull();
  });

  it('renders the default 2x1 ghost with S1/S2/S3/W1 badges', () => {
    renderLayer();
    for (const label of ['Q', 'C', 'X', 'Y', 'Z'])
      expect(screen.getByTestId(`ghost-${label}`)).toBeInTheDocument();
    expect(screen.getByTestId('ghost-Z')).toHaveAttribute('data-ghost-id', 'ghost-Z');
    expect(badge('Z')).toBe('S1');
    expect(badge('Y')).toBe('S2');
    expect(badge('C')).toBe('S3');
    expect(badge('X')).toBe('W1');
    expect(screen.queryByTestId('ghost-number-Q')).toBeNull();
  });

  it('renders a chosen Trips ghost with its own numbering', () => {
    store().setGhostFormation('5v5-off-trips');
    renderLayer();
    for (const label of ['Q', 'C', 'Z', 'Y', 'H'])
      expect(screen.getByTestId(`ghost-${label}`)).toBeInTheDocument();
    expect(screen.queryByTestId('ghost-X')).toBeNull();
    expect(badge('Z')).toBe('S1');
    expect(badge('Y')).toBe('S2');
    expect(badge('H')).toBe('S3');
    expect(screen.queryByTestId('ghost-number-C')).toBeNull();
  });

  it('follows ghost formation changes', () => {
    renderLayer();
    expect(screen.getByTestId('ghost-X')).toBeInTheDocument();
    act(() => store().setGhostFormation('5v5-off-trips'));
    expect(screen.queryByTestId('ghost-X')).toBeNull();
    expect(screen.getByTestId('ghost-H')).toBeInTheDocument();
  });

  it('renders hit circles only while the man tool is active', () => {
    renderLayer();
    expect(document.querySelectorAll('circle[data-kind="ghost"]')).toHaveLength(0);
    act(() => store().setTool('man'));
    const circles = Array.from(document.querySelectorAll('circle[data-kind="ghost"]'));
    // 2x1: QB, C and the 3 eligible receivers can all be referenced.
    expect(circles.map((c) => c.getAttribute('data-ghost-id')).sort()).toEqual([
      'ghost-C',
      'ghost-Q',
      'ghost-X',
      'ghost-Y',
      'ghost-Z',
    ]);
    expect(hits().length).toBeGreaterThanOrEqual(circles.length);
    act(() => store().setTool('select'));
    expect(document.querySelectorAll('circle[data-kind="ghost"]')).toHaveLength(0);
  });
});

describe('EditorCanvas man assignment (FR-DEF-02)', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('pointerdown on CB1 then on ghost Z assigns strong #1', () => {
    store().setTool('man');
    render(<EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap />);
    const at = (p: { x: number; y: number }) => {
      const s = toScreen(p, viewport);
      return { clientX: s.x, clientY: s.y };
    };
    fireEvent.pointerDown(screen.getByTestId('token-CB1'), { pointerId: 1, ...at({ x: 11, y: 5 }) });
    expect(store().draft).toEqual({ kind: 'man', slotId: 'cb1' });
    const hit = document.querySelector('[data-ghost-id="ghost-Z"]');
    expect(hit).not.toBeNull();
    fireEvent.pointerDown(hit as Element, { pointerId: 1, ...at({ x: 12, y: -1 }) });
    expect(store().play?.players.find((s) => s.id === 'cb1')?.actions).toEqual([
      { type: 'man', target: { kind: 'number', side: 'strong', number: 1 }, technique: 'trail' },
    ]);
    expect(store().draft).toBeNull();
  });
});
