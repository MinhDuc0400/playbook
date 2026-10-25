import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import {
  defaultViewport,
  fitViewport,
  panBy,
  toField,
  toScreen,
  yardsToPx,
  zoomAt,
  type Viewport,
} from '../viewport';

const vp0: Viewport = { width: 800, height: 600, scale: 10, center: { x: 0, y: 0 } };

const vpArb = fc.record({
  width: fc.integer({ min: 50, max: 3000 }),
  height: fc.integer({ min: 50, max: 3000 }),
  scale: fc.double({ min: 2, max: 200, noNaN: true }),
  center: fc.record({
    x: fc.double({ min: -100, max: 100, noNaN: true }),
    y: fc.double({ min: -100, max: 100, noNaN: true }),
  }),
});
const pointArb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true }),
});

describe('T-DOM-07 toField(toScreen(p)) = p', () => {
  it('round-trips within 0.01 yd for random points and viewports', () => {
    fc.assert(
      fc.property(pointArb, vpArb, (p, vp) => {
        const q = toField(toScreen(p, vp), vp);
        expect(Math.abs(q.x - p.x)).toBeLessThan(0.01);
        expect(Math.abs(q.y - p.y)).toBeLessThan(0.01);
      }),
    );
  });

  it('puts the field origin at the viewport centre when center = (0,0)', () => {
    expect(toScreen({ x: 0, y: 0 }, vp0)).toEqual({ x: 400, y: 300 });
  });

  it('+y goes up on screen and +x goes right', () => {
    const o = toScreen({ x: 0, y: 0 }, vp0);
    expect(toScreen({ x: 0, y: 1 }, vp0).y).toBeLessThan(o.y);
    expect(toScreen({ x: 1, y: 0 }, vp0).x).toBeGreaterThan(o.x);
    expect(toScreen({ x: 1, y: 0 }, vp0).x - o.x).toBe(10);
  });
});

describe('defaultViewport / fitViewport', () => {
  const field = createDefaultFields()['5v5'];

  it('shows y -10..25 and the full width inside the padded canvas', () => {
    const w = 900;
    const h = 700;
    const vp = defaultViewport(w, h, field, DEFAULT_BALL_SPOT);
    const bl = toScreen({ x: -15, y: -10 }, vp);
    const tr = toScreen({ x: 15, y: 25 }, vp);
    const pad = 16;
    expect(bl.x).toBeGreaterThanOrEqual(pad - 1e-9);
    expect(bl.y).toBeLessThanOrEqual(h - pad + 1e-9);
    expect(tr.x).toBeLessThanOrEqual(w - pad + 1e-9);
    expect(tr.y).toBeGreaterThanOrEqual(pad - 1e-9);
    const tightX = Math.abs(bl.x - pad) < 1e-6 && Math.abs(tr.x - (w - pad)) < 1e-6;
    const tightY = Math.abs(tr.y - pad) < 1e-6 && Math.abs(bl.y - (h - pad)) < 1e-6;
    expect(tightX || tightY).toBe(true);
  });

  it('follows ballSpot.x (sidelines shift)', () => {
    const vp = defaultViewport(900, 700, field, { x: 5, yardLine: 15 });
    expect(vp.center.x).toBeCloseTo(-5);
  });

  it('fitViewport honours custom padding and centres the rect', () => {
    const vp = fitViewport(100, 100, { minX: 0, maxX: 10, minY: 0, maxY: 10 }, 0);
    expect(vp.scale).toBeCloseTo(10);
    expect(vp.center).toEqual({ x: 5, y: 5 });
  });
});

describe('zoomAt / panBy / yardsToPx', () => {
  it('keeps the field point under the anchor fixed', () => {
    const anchor = { x: 123, y: 456 };
    const before = toField(anchor, vp0);
    const vp = zoomAt(vp0, anchor, 1.7);
    expect(vp.scale).toBeCloseTo(17);
    const after = toField(anchor, vp);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('clamps scale to [2, 200]', () => {
    expect(zoomAt(vp0, { x: 0, y: 0 }, 1000).scale).toBe(200);
    expect(zoomAt(vp0, { x: 0, y: 0 }, 0.0001).scale).toBe(2);
  });

  it('keeps the anchor fixed even when clamped', () => {
    const anchor = { x: 50, y: 70 };
    const before = toField(anchor, vp0);
    const after = toField(anchor, zoomAt(vp0, anchor, 1000));
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('panBy moves the centre opposite the drag, in yards', () => {
    const vp = panBy(vp0, 20, 30);
    expect(vp.center.x).toBeCloseTo(-2);
    expect(vp.center.y).toBeCloseTo(3);
    // Content followed the pointer: origin is now 20 px right, 30 px down.
    expect(toScreen({ x: 0, y: 0 }, vp)).toEqual({ x: 420, y: 330 });
  });

  it('yardsToPx multiplies by scale', () => {
    expect(yardsToPx(5, vp0)).toBe(50);
  });
});
