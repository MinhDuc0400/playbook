import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createDefaultFields } from '@/domain/field';
import type { Point } from '@/domain/types';
import { FieldSvg } from '../FieldSvg';
import { ZoneShape, type ZoneShapeProps } from '../ZoneShape';
import { defaultViewport, toScreen } from '../viewport';

const field = createDefaultFields()['5v5'];
const ballSpot = { x: 0, yardLine: 15 };
const viewport = defaultViewport(900, 700, field, ballSpot);
const polygon: Point[] = [
  { x: -7, y: 10 },
  { x: 7, y: 10 },
  { x: 7, y: 30 },
  { x: -7, y: 30 },
];

function renderZone(props: Partial<ZoneShapeProps> = {}) {
  return render(
    <FieldSvg field={field} ballSpot={ballSpot} viewport={viewport}>
      <ZoneShape polygon={polygon} kind="deep" testId="z" slotId="s1" {...props} />
    </FieldSvg>,
  );
}

const area = () => screen.getByTestId('z').querySelector('[data-part="area"]') as SVGPolygonElement;

describe('ZoneShape (FR-DEF-03, §12.2)', () => {
  it('draws the polygon through toScreen of the yard points', () => {
    renderZone();
    const expected = polygon
      .map((p) => {
        const s = toScreen(p, viewport);
        return `${s.x},${s.y}`;
      })
      .join(' ');
    expect(area().getAttribute('points')).toBe(expected);
  });

  it('is translucent with a same-colour 1 px stroke', () => {
    renderZone();
    expect(Number(area().getAttribute('fill-opacity'))).toBeCloseTo(0.18);
    expect(area().getAttribute('stroke')).toBe(area().getAttribute('fill'));
    expect(area().getAttribute('stroke-width')).toBe('1');
  });

  it.each([
    ['deep', '#3b82f6'],
    ['flat', '#f59e0b'],
    ['hook', '#22c55e'],
    ['curl', '#14b8a6'],
    ['custom', '#9ca3af'],
  ] as const)('%s zones are %s', (kind, color) => {
    renderZone({ kind });
    expect(screen.getByTestId('z')).toHaveAttribute('data-zone-kind', kind);
    expect(area().getAttribute('fill')).toBe(color);
  });

  it('shows the drop handle only with showDropHandle, but always a dot', () => {
    const { unmount } = renderZone({ dropPoint: { x: 0, y: 14 } });
    expect(screen.getByTestId('z').querySelector('[data-part="drop-dot"]')).not.toBeNull();
    expect(document.querySelector('[data-kind="dropPoint"]')).toBeNull();
    unmount();
    renderZone({ dropPoint: { x: 0, y: 14 }, showDropHandle: true });
    const handle = document.querySelector('[data-kind="dropPoint"]');
    expect(handle).toHaveAttribute('data-slot-id', 's1');
    const s = toScreen({ x: 0, y: 14 }, viewport);
    expect(Number(handle?.getAttribute('cx'))).toBeCloseTo(s.x);
    expect(Number(handle?.getAttribute('cy'))).toBeCloseTo(s.y);
  });

  it('renders no handle or dot without a drop point', () => {
    renderZone({ showDropHandle: true });
    expect(document.querySelector('[data-kind="dropPoint"]')).toBeNull();
    expect(screen.getByTestId('z').querySelector('[data-part="drop-dot"]')).toBeNull();
  });
});
