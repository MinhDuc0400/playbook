import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '@/domain/field';
import { FieldSvg } from '../FieldSvg';
import { PlayerToken, type PlayerTokenProps } from '../PlayerToken';
import { defaultViewport, toScreen } from '../viewport';

const field = createDefaultFields()['5v5'];
const ballSpot = { x: 0, yardLine: 15 };
const viewport = defaultViewport(900, 700, field, ballSpot);

function renderToken(props: Partial<PlayerTokenProps> = {}) {
  return render(
    <FieldSvg field={field} ballSpot={ballSpot} viewport={viewport}>
      <PlayerToken id="p1" side="offense" label="X" pos={{ x: 3, y: -2 }} {...props} />
    </FieldSvg>,
  );
}

describe('PlayerToken (§12.2)', () => {
  it('offense: circle at toScreen(pos) with the label inside', () => {
    renderToken();
    const g = screen.getByTestId('token-X');
    const c = toScreen({ x: 3, y: -2 }, viewport);
    const circle = g.querySelector('circle[data-part="body"]');
    expect(circle).not.toBeNull();
    expect(Number(circle?.getAttribute('cx'))).toBeCloseTo(c.x);
    expect(Number(circle?.getAttribute('cy'))).toBeCloseTo(c.y);
    const text = g.querySelector('text');
    expect(text).toHaveTextContent('X');
    expect(text).toHaveAttribute('text-anchor', 'middle');
    expect(Number(text?.getAttribute('x'))).toBeCloseTo(c.x);
    expect(g).toHaveAttribute('data-kind', 'player');
    expect(g).toHaveAttribute('data-slot-id', 'p1');
    expect(g).toHaveAttribute('aria-label', 'X');
  });

  it('defense: triangle polygon with the label beside it', () => {
    renderToken({ side: 'defense', label: 'CB1' });
    const g = screen.getByTestId('token-CB1');
    const c = toScreen({ x: 3, y: -2 }, viewport);
    const poly = g.querySelector('polygon[data-part="body"]');
    expect(poly).not.toBeNull();
    expect(poly?.getAttribute('points')?.trim().split(/\s+/)).toHaveLength(3);
    expect(g.querySelector('circle[data-part="body"]')).toBeNull();
    const text = g.querySelector('text');
    expect(text).toHaveTextContent('CB1');
    expect(Number(text?.getAttribute('x'))).toBeGreaterThan(c.x);
  });

  it.each([
    ['weak', '#dc2626'],
    ['avg', '#9ca3af'],
    ['good', '#16a34a'],
    ['custom', '#9333ea'],
  ] as const)('FR-ATH-02 ring colour for %s', (level, color) => {
    renderToken({ level });
    expect(screen.getByTestId('token-X').querySelector('[data-part="body"]')).toHaveAttribute(
      'stroke',
      color,
    );
  });

  it('has no ring when level is omitted', () => {
    renderToken();
    expect(screen.getByTestId('token-X').querySelector('[data-part="body"]')).toHaveAttribute(
      'stroke',
      'none',
    );
  });

  it('ghost is faded, non-interactive and tagged as ghost', () => {
    renderToken({ ghost: true });
    const g = screen.getByTestId('ghost-X');
    expect(g).toHaveAttribute('opacity', '0.35');
    expect(g).toHaveAttribute('pointer-events', 'none');
    expect(g).toHaveAttribute('data-kind', 'ghost');
    expect(g).toHaveAttribute('data-ghost-id', 'p1');
    expect(g).not.toHaveAttribute('data-slot-id');
    expect(screen.queryByTestId('token-X')).toBeNull();
  });

  it('selected adds a highlight and thickens the stroke', () => {
    const { unmount } = renderToken({ level: 'avg' });
    const base = Number(
      screen.getByTestId('token-X').querySelector('[data-part="body"]')?.getAttribute('stroke-width'),
    );
    expect(screen.getByTestId('token-X').querySelector('[data-part="selection"]')).toBeNull();
    unmount();
    renderToken({ level: 'avg', selected: true });
    const g = screen.getByTestId('token-X');
    expect(g.querySelector('[data-part="selection"]')).not.toBeNull();
    expect(Number(g.querySelector('[data-part="body"]')?.getAttribute('stroke-width'))).toBeGreaterThan(base);
  });

  it('FR-DEF-04 rusher mark only when rusher', () => {
    const { unmount } = renderToken({ side: 'defense' });
    expect(screen.queryByTestId('rusher-mark')).toBeNull();
    unmount();
    renderToken({ side: 'defense', rusher: true });
    expect(screen.getByTestId('rusher-mark')).toBeInTheDocument();
  });

  it('FR-OFF-04 progression badge shows the index', () => {
    const { unmount } = renderToken();
    expect(screen.queryByTestId('progression-badge')).toBeNull();
    unmount();
    renderToken({ progressionIndex: 2 });
    expect(screen.getByTestId('progression-badge')).toHaveTextContent('2');
  });

  it('leverage dot moves toward inside / outside according to insideSign, head-up goes toward the offense', () => {
    const c = toScreen({ x: 3, y: -2 }, viewport);
    const dotFor = (props: Partial<PlayerTokenProps>) => {
      const { unmount } = renderToken({ side: 'defense', ...props });
      const dot = screen.getByTestId('leverage-dot');
      const p = { x: Number(dot.getAttribute('cx')), y: Number(dot.getAttribute('cy')) };
      unmount();
      return p;
    };
    const inPos = dotFor({ leverage: 'inside', insideSign: 1 });
    const outPos = dotFor({ leverage: 'outside', insideSign: 1 });
    const inNeg = dotFor({ leverage: 'inside', insideSign: -1 });
    const head = dotFor({ leverage: 'head-up' });
    expect(inPos.x).toBeGreaterThan(c.x);
    expect(outPos.x).toBeLessThan(c.x);
    expect(inNeg.x).toBeLessThan(c.x);
    expect(head.x).toBeCloseTo(c.x);
    expect(head.y).toBeGreaterThan(c.y); // −y field = screen down
  });

  it('no leverage dot without leverage', () => {
    renderToken({ side: 'defense' });
    expect(screen.queryByTestId('leverage-dot')).toBeNull();
  });
});
