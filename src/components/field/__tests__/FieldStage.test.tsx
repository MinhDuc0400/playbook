import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { t } from '@/i18n/vi';
import { useFieldContext } from '../FieldContext';
import { FieldStage } from '../FieldStage';
import { defaultViewport, type Viewport } from '../viewport';

const field = createDefaultFields()['5v5'];
const W = 800;
const H = 600;

let roCallbacks: ResizeObserverCallback[] = [];

// jsdom has no PointerEvent; fireEvent.pointerX would drop clientX/pointerId without it.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

beforeEach(() => {
  roCallbacks = [];
  vi.stubGlobal('PointerEvent', FakePointerEvent);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        roCallbacks.push(cb);
      }
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Probe({ onVp }: { onVp: (vp: Viewport) => void }) {
  onVp(useFieldContext().viewport);
  return null;
}

function renderStage() {
  let latest: Viewport | null = null;
  render(
    <FieldStage field={field} ballSpot={DEFAULT_BALL_SPOT}>
      <Probe onVp={(vp) => (latest = vp)} />
    </FieldStage>,
  );
  return { vp: () => latest! };
}

describe('FieldStage', () => {
  it('renders the svg at the measured size and the fit button', () => {
    renderStage();
    const svg = screen.getByTestId('field-svg');
    expect(svg).toHaveAttribute('width', String(W));
    expect(svg).toHaveAttribute('height', String(H));
    const fit = screen.getByTestId('btn-fit');
    expect(fit).toHaveAttribute('aria-label', t.field.fit);
    expect(fit).toHaveAttribute('title', t.field.fit);
  });

  it('starts at the default viewport', () => {
    const { vp } = renderStage();
    expect(vp()).toEqual(defaultViewport(W, H, field, DEFAULT_BALL_SPOT));
  });

  it('wheel zooms around the cursor and fit restores the default viewport', () => {
    const { vp } = renderStage();
    const initial = vp();
    fireEvent.wheel(screen.getByTestId('field-stage'), { deltaY: -300, clientX: 100, clientY: 100 });
    expect(vp().scale).toBeGreaterThan(initial.scale);
    expect(vp().center).not.toEqual(initial.center);

    fireEvent.click(screen.getByTestId('btn-fit'));
    expect(vp()).toEqual(initial);
  });

  it('keeps centre and scale but updates the size when the container resizes', () => {
    const { vp } = renderStage();
    const before = vp();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 500,
      width: 1000,
      height: 500,
      toJSON: () => ({}),
    });
    act(() => {
      for (const cb of roCallbacks) {
        cb([{ contentRect: { width: 1000, height: 500 } } as ResizeObserverEntry], {} as ResizeObserver);
      }
    });
    expect(vp()).toEqual({ ...before, width: 1000, height: 500 });
  });

  it('Space + drag pans the field; ignored while typing in an input', () => {
    const { vp } = renderStage();
    const stage = screen.getByTestId('field-stage');
    const start = vp();

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(stage.className).toContain('cursor-grab');
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 150, clientY: 80 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 150, clientY: 80 });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(stage.className).not.toContain('cursor-grab');
    expect(vp().center.x).toBeCloseTo(start.center.x - 50 / start.scale);
    expect(vp().center.y).toBeCloseTo(start.center.y - 20 / start.scale);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { code: 'Space', key: ' ' });
    expect(stage.className).not.toContain('cursor-grab');
    input.remove();
  });

  it('drag without Space does not pan', () => {
    const { vp } = renderStage();
    const stage = screen.getByTestId('field-stage');
    const start = vp();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 150, clientY: 80 });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    expect(vp()).toEqual(start);
  });

  it('two-pointer pinch zooms in', () => {
    const { vp } = renderStage();
    const stage = screen.getByTestId('field-stage');
    const start = vp();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 380, clientY: 300 });
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 420, clientY: 300 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 340, clientY: 300 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 460, clientY: 300 });
    expect(vp().scale).toBeGreaterThan(start.scale);
  });

  it('renders overlayControls next to the fit button', () => {
    render(
      <FieldStage
        field={field}
        ballSpot={DEFAULT_BALL_SPOT}
        overlayControls={<button data-testid="extra" />}
      />,
    );
    expect(screen.getByTestId('extra')).toBeInTheDocument();
  });
});

describe('FieldStage without ResizeObserver', () => {
  it('measures once via getBoundingClientRect', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<FieldStage field={field} ballSpot={DEFAULT_BALL_SPOT} />);
    expect(screen.getByTestId('field-svg')).toHaveAttribute('width', String(W));
  });
});
