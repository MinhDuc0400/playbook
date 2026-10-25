import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultFields } from '@/domain/field';
import { t } from '@/i18n/vi';
import { useFieldContext } from '../FieldContext';
import { FieldSvg } from '../FieldSvg';
import { defaultViewport, toScreen } from '../viewport';

const field = createDefaultFields()['5v5'];
const spot = (yardLine: number) => ({ x: 0, yardLine });
const W = 900;
const H = 700;

afterEach(cleanup);

function renderField(yardLine = 15, extra: Partial<React.ComponentProps<typeof FieldSvg>> = {}) {
  const ballSpot = spot(yardLine);
  const viewport = defaultViewport(W, H, field, ballSpot);
  const utils = render(<FieldSvg field={field} ballSpot={ballSpot} viewport={viewport} {...extra} />);
  return { ...utils, viewport, ballSpot };
}

describe('FieldSvg (FR-FLD-01)', () => {
  it('sizes the svg to the viewport', () => {
    renderField();
    const svg = screen.getByTestId('field-svg');
    expect(svg).toHaveAttribute('width', String(W));
    expect(svg).toHaveAttribute('height', String(H));
    expect(svg).toHaveAttribute('viewBox', `0 0 ${W} ${H}`);
  });

  it('draws the LOS at y=0 on screen', () => {
    const { viewport } = renderField();
    const los = screen.getByTestId('los');
    const y = toScreen({ x: 0, y: 0 }, viewport).y;
    expect(Number(los.getAttribute('y1'))).toBeCloseTo(y);
    expect(Number(los.getAttribute('y2'))).toBeCloseTo(y);
  });

  it('draws the rush line 7 yd from the LOS via toScreen', () => {
    const { viewport } = renderField();
    const y = toScreen({ x: 0, y: field.rushLine }, viewport).y;
    expect(field.rushLine).toBe(7);
    expect(Number(screen.getByTestId('rush-line').getAttribute('y1'))).toBeCloseTo(y);
    expect(y).toBeLessThan(toScreen({ x: 0, y: 0 }, viewport).y);
  });

  it('draws the line-to-gain at midfield (yard line 25)', () => {
    const { viewport, ballSpot } = renderField();
    const y = toScreen({ x: 0, y: 25 - ballSpot.yardLine }, viewport).y;
    const ltg = screen.getAllByTestId('line-to-gain');
    expect(ltg).toHaveLength(1);
    expect(Number(ltg[0]!.getAttribute('y1'))).toBeCloseTo(y);
  });

  it('draws 11 five-yard lines (0,5,...,50) with thicker goal lines', () => {
    const { container } = renderField();
    const lines = container.querySelectorAll('[data-testid^="yardline-"]');
    expect(lines).toHaveLength(11);
    for (let n = 0; n <= 50; n += 5) expect(screen.getByTestId(`yardline-${n}`)).toBeInTheDocument();
    const goal = Number(screen.getByTestId('yardline-0').getAttribute('stroke-width'));
    const mid = Number(screen.getByTestId('yardline-10').getAttribute('stroke-width'));
    expect(goal).toBeGreaterThan(mid);
    expect(Number(screen.getByTestId('yardline-50').getAttribute('stroke-width'))).toBe(goal);
  });

  it('draws two sidelines and both end zones', () => {
    renderField();
    expect(screen.getAllByTestId('sideline')).toHaveLength(2);
    expect(screen.getByTestId('end-zone-own')).toBeInTheDocument();
    expect(screen.getByTestId('end-zone-opp')).toBeInTheDocument();
  });

  it('draws the two no-run zones as bands at the right place', () => {
    const { viewport, ballSpot } = renderField();
    const zones = screen.getAllByTestId('no-run-zone');
    expect(zones).toHaveLength(2);
    // zone 20..25 → y 5..10 relative to the LOS at yard line 15
    const top = toScreen({ x: 0, y: 25 - ballSpot.yardLine }, viewport).y;
    expect(Number(zones[0]!.getAttribute('y'))).toBeCloseTo(top);
    expect(Number(zones[0]!.getAttribute('height'))).toBeCloseTo(5 * viewport.scale);
  });

  it('shows the no-run badge only when the ball is in a no-run zone', () => {
    const { unmount } = renderField(22);
    expect(screen.getByTestId('no-run-badge')).toHaveTextContent(t.field.noRunBadge);
    unmount();
    renderField(15);
    expect(screen.queryByTestId('no-run-badge')).not.toBeInTheDocument();
  });

  it('renders children that can read useFieldContext()', () => {
    function Probe() {
      const ctx = useFieldContext();
      return <circle data-testid="probe" data-scale={ctx.viewport.scale} data-yl={ctx.ballSpot.yardLine} />;
    }
    const ballSpot = spot(15);
    const viewport = defaultViewport(W, H, field, ballSpot);
    render(
      <FieldSvg field={field} ballSpot={ballSpot} viewport={viewport}>
        <Probe />
      </FieldSvg>,
    );
    const probe = screen.getByTestId('probe');
    expect(Number(probe.getAttribute('data-scale'))).toBeCloseTo(viewport.scale);
    expect(probe.getAttribute('data-yl')).toBe('15');
  });

  it('draws a 1-yd grid only when showGrid', () => {
    const { unmount } = renderField(15);
    expect(screen.queryAllByTestId('grid-line')).toHaveLength(0);
    unmount();
    renderField(15, { showGrid: true });
    expect(screen.getAllByTestId('grid-line').length).toBeGreaterThan(50);
  });

  it('contrast theme uses thicker strokes than normal', () => {
    const { unmount } = renderField(15);
    const normal = Number(screen.getByTestId('los').getAttribute('stroke-width'));
    unmount();
    renderField(15, { theme: 'contrast' });
    expect(screen.getByTestId('field-svg')).toHaveAttribute('data-theme', 'contrast');
    expect(Number(screen.getByTestId('los').getAttribute('stroke-width'))).toBeGreaterThan(normal);
  });
});
