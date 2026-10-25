import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '@/domain/field';
import { FieldSvg } from '../FieldSvg';
import { RoutePath, type RoutePathProps } from '../RoutePath';
import { defaultViewport } from '../viewport';

const field = createDefaultFields()['5v5'];
const ballSpot = { x: 0, yardLine: 15 };
const viewport = defaultViewport(900, 700, field, ballSpot);
const path = [
  { x: 0, y: 10 },
  { x: 5, y: 10 },
  { x: 5, y: 15 },
];

function renderPath(props: Partial<RoutePathProps> = {}) {
  return render(
    <FieldSvg field={field} ballSpot={ballSpot} viewport={viewport}>
      <RoutePath from={{ x: 0, y: 0 }} path={path} variant="route" testId="rp" slotId="s1" {...props} />
    </FieldSvg>,
  );
}

const line = () => screen.getByTestId('rp').querySelector('[data-part="line"]') as SVGPathElement;

describe('RoutePath (§12.2)', () => {
  it('route: solid line with an arrowhead and slot hooks', () => {
    renderPath();
    const g = screen.getByTestId('rp');
    expect(g).toHaveAttribute('data-slot-id', 's1');
    expect(g.querySelector('polygon[data-part="arrowhead"]')).not.toBeNull();
    expect(line()).not.toHaveAttribute('stroke-dasharray');
    expect(Number(line().getAttribute('stroke-width'))).toBe(2);
  });

  it('primary route is bolder', () => {
    const { unmount } = renderPath();
    const normal = Number(line().getAttribute('stroke-width'));
    unmount();
    renderPath({ primary: true });
    expect(Number(line().getAttribute('stroke-width'))).toBeGreaterThan(normal);
  });

  it('motion: dashed zigzag, no arrowhead', () => {
    renderPath({ variant: 'motion' });
    const g = screen.getByTestId('rp');
    expect(line()).toHaveAttribute('stroke-dasharray');
    // zigzag has many more vertices than the 4-point route polyline
    expect((line().getAttribute('d')?.match(/L/g) ?? []).length).toBeGreaterThan(10);
    expect(g.querySelector('polygon')).toBeNull();
  });

  it.each([
    ['option-man', 'M'],
    ['option-zone', 'Z'],
  ] as const)('%s shows the %s label and is dashed', (variant, text) => {
    renderPath({ variant });
    expect(screen.getByTestId('rp').querySelector('[data-part="option-label"]')).toHaveTextContent(text);
    expect(line()).toHaveAttribute('stroke-dasharray');
  });

  it('route has no option label', () => {
    renderPath();
    expect(screen.getByTestId('rp').querySelector('[data-part="option-label"]')).toBeNull();
  });

  it('man is thin and dashed without an arrow; rush is bold with an arrow', () => {
    const { unmount } = renderPath({ variant: 'man' });
    expect(Number(line().getAttribute('stroke-width'))).toBe(1);
    expect(line()).toHaveAttribute('stroke-dasharray');
    expect(screen.getByTestId('rp').querySelector('polygon')).toBeNull();
    unmount();
    renderPath({ variant: 'rush' });
    expect(Number(line().getAttribute('stroke-width'))).toBeGreaterThanOrEqual(3.5);
    expect(screen.getByTestId('rp').querySelector('polygon')).not.toBeNull();
  });

  it('smooth vertices render a Q curve; sharp ones do not', () => {
    const { unmount } = renderPath({ smooth: [false, false, false] });
    expect(line().getAttribute('d')).not.toContain('Q');
    unmount();
    renderPath({ smooth: [true, false, false] });
    expect(line().getAttribute('d')).toContain('Q');
  });

  it('segment hit paths carry data-kind and the end-point index', () => {
    renderPath();
    const segs = screen.getByTestId('rp').querySelectorAll('[data-kind="routeSegment"]');
    expect(Array.from(segs).map((s) => s.getAttribute('data-index'))).toEqual(['0', '1', '2']);
    segs.forEach((s) => {
      expect(s).toHaveAttribute('stroke', 'transparent');
      expect(s).toHaveAttribute('stroke-width', '10');
      expect(s).toHaveAttribute('pointer-events', 'stroke');
    });
  });

  it('handles appear only with showHandles; smooth = circle, sharp = square', () => {
    const { unmount } = renderPath({ smooth: [true, false, true] });
    expect(screen.getByTestId('rp').querySelectorAll('[data-kind="routePoint"]')).toHaveLength(0);
    unmount();
    renderPath({ smooth: [true, false, true], showHandles: true });
    const pts = Array.from(screen.getByTestId('rp').querySelectorAll('[data-kind="routePoint"]'));
    expect(pts.map((p) => p.getAttribute('data-index'))).toEqual(['0', '1', '2']);
    expect(pts.map((p) => p.tagName.toLowerCase())).toEqual(['circle', 'rect', 'circle']);
  });

  it('selected adds a highlight underlay', () => {
    const { unmount } = renderPath();
    expect(screen.getByTestId('rp').querySelector('[data-part="selection"]')).toBeNull();
    unmount();
    renderPath({ selected: true });
    expect(screen.getByTestId('rp').querySelector('[data-part="selection"]')).not.toBeNull();
  });

  it('renders nothing for an empty path', () => {
    renderPath({ path: [] });
    expect(screen.queryByTestId('rp')).toBeNull();
  });
});
