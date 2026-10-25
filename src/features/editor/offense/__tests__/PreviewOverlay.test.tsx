import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toScreen, defaultViewport } from '@/components/field/viewport';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { buildRoute } from '@/domain/routeTree';
import { SCHEMA_VERSION, type Play, type PlayerSlot, type Point } from '@/domain/types';
import { frameAt } from '@/engine/frames';
import { previewOffense } from '@/engine/preview';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { PreviewOverlay } from '../PreviewOverlay';

const field = createDefaultFields()['5v5'];
const W = 800;
const H = 600;
const tuning = { ...DEFAULT_TUNING };

function slot(
  id: string,
  role: PlayerSlot['role'],
  start: Point,
  label: string,
  actions: PlayerSlot['actions'] = [],
): PlayerSlot {
  return { id, role, label, start, actions };
}

function offense(): Play {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test',
    side: 'offense',
    format: '5v5',
    formation: 'Test',
    strength: 'right',
    tags: [],
    createdAt: 1,
    updatedAt: 2,
    players: [
      slot('q', 'QB', { x: 0, y: -5 }, 'Q', [{ type: 'qbDrop', depth: 2, style: 'shotgun' }]),
      slot('c', 'C', { x: 0, y: 0 }, 'C'),
      slot('x', 'WR', { x: -8, y: 0 }, 'X', [buildRoute('go', { x: -8, y: 0 }, { outward: -1 })]),
      slot('z', 'WR', { x: 8, y: 0 }, 'Z', [buildRoute('slant', { x: 8, y: 0 }, { outward: 1 })]),
    ],
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
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
  act(() => useEditorStore.getState().load(offense()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  act(() => useEditorStore.getState().load(null));
});

function renderOverlay(onClose = vi.fn()) {
  render(<PreviewOverlay field={field} ballSpot={DEFAULT_BALL_SPOT} tuning={tuning} onClose={onClose} />);
  return onClose;
}

function bodyCenter(label: string): { x: number; y: number } {
  const body = screen.getByTestId(`token-${label}`).querySelector('[data-part="body"]');
  if (!body) throw new Error(`no body for ${label}`);
  return { x: Number(body.getAttribute('cx')), y: Number(body.getAttribute('cy')) };
}

describe('PreviewOverlay (FR-OFF-06)', () => {
  it('renders nothing for a defense play', () => {
    act(() => useEditorStore.getState().load({ ...offense(), side: 'defense' }));
    renderOverlay();
    expect(screen.queryByTestId('preview-overlay')).toBeNull();
  });

  it('renders a token per player, faded planned routes and the timeline', () => {
    renderOverlay();
    expect(screen.getByTestId('preview-overlay')).toBeInTheDocument();
    for (const label of ['Q', 'C', 'X', 'Z'])
      expect(screen.getByTestId(`token-${label}`)).toBeInTheDocument();
    const routes = screen.getByTestId('preview-routes');
    expect(routes).toHaveAttribute('opacity', '0.35');
    expect(routes.querySelectorAll('[data-variant="route"]')).toHaveLength(2);
    expect(screen.getByTestId('timeline')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-marker').length).toBeGreaterThan(0); // snap at least
  });

  it('draws tokens at the engine frame after seeking (UI never computes positions)', () => {
    renderOverlay();
    const play = offense();
    const { frames, duration } = previewOffense({
      play,
      field,
      ballSpot: DEFAULT_BALL_SPOT,
      tuning,
    });
    const vp = defaultViewport(W, H, field, DEFAULT_BALL_SPOT);

    fireEvent.click(screen.getByTestId('btn-play')); // autoPlay -> pause
    const at = (sec: number) => {
      fireEvent.change(screen.getByTestId('timeline-scrubber'), { target: { value: String(sec) } });
    };

    at(0);
    const start = bodyCenter('X');
    at(2);
    const moved = bodyCenter('X');
    expect(moved).not.toEqual(start);

    for (const sec of [0, 1, 2, duration]) {
      at(sec);
      const frame = frameAt(frames, sec);
      for (const s of play.players) {
        const expected = toScreen(frame!.players[s.id]!.pos, vp);
        const got = bodyCenter(s.label);
        expect(got.x).toBeCloseTo(expected.x, 3);
        expect(got.y).toBeCloseTo(expected.y, 3);
      }
    }
  });

  it('close button calls onClose', () => {
    const onClose = renderOverlay();
    fireEvent.click(screen.getByTestId('btn-preview-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('btn-preview-close')).toHaveTextContent(t.offense.preview.close);
  });

  it('autoplays and Space toggles play/pause (ignored while typing in inputs)', () => {
    renderOverlay();
    const play = screen.getByTestId('btn-play');
    expect(play).toHaveAttribute('aria-label', t.playback.pause); // autoPlay -> playing

    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(screen.getByTestId('btn-play')).toHaveAttribute('aria-label', t.playback.play);
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(screen.getByTestId('btn-play')).toHaveAttribute('aria-label', t.playback.pause);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: ' ', code: 'Space' });
    expect(screen.getByTestId('btn-play')).toHaveAttribute('aria-label', t.playback.pause);
    input.remove();
  });

  it('removes the Space listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(
      <PreviewOverlay field={field} ballSpot={DEFAULT_BALL_SPOT} tuning={tuning} onClose={vi.fn()} />,
    );
    unmount();
    expect(remove.mock.calls.some(([type]) => type === 'keydown')).toBe(true);
  });
});
