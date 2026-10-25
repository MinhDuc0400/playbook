import { describe, expect, it } from 'vitest';
import {
  ROUTE_TEMPLATE_IDS,
  ROUTE_TEMPLATES,
  buildRoute,
  isRouteTemplateId,
  localToField,
  outwardSign,
  type RouteTemplateId,
} from '../routeTree';

const STOP_IDS: RouteTemplateId[] = ['hitch', 'curl', 'comeback'];

const SHAPE_LENGTH: Record<RouteTemplateId, number> = {
  hitch: 2,
  slant: 2,
  out: 2,
  in: 2,
  go: 1,
  post: 2,
  corner: 2,
  curl: 2,
  comeback: 2,
  flat: 2,
  drag: 2,
  wheel: 3,
  whip: 2,
  'out-and-up': 3,
  sluggo: 3,
};

describe('T-DOM-06 route templates orientation', () => {
  it('T-DOM-06 slant from the left goes inside (x increases)', () => {
    const start = { x: -10, y: -1 };
    const route = buildRoute('slant', start);
    for (const p of route.path) expect(p.x).toBeGreaterThanOrEqual(start.x);
    expect(route.path[route.path.length - 1]!.x).toBeGreaterThan(start.x);
  });

  it('slant from the right goes inside (x decreases)', () => {
    const start = { x: 10, y: -1 };
    const route = buildRoute('slant', start);
    for (const p of route.path) expect(p.x).toBeLessThanOrEqual(start.x);
    expect(route.path[route.path.length - 1]!.x).toBeLessThan(start.x);
  });

  it('out from the left goes to -x, from the right to +x', () => {
    const left = buildRoute('out', { x: -8, y: 0 });
    const right = buildRoute('out', { x: 8, y: 0 });
    expect(left.path[left.path.length - 1]!.x).toBeLessThan(-8);
    expect(right.path[right.path.length - 1]!.x).toBeGreaterThan(8);
  });

  it('mirrors left and right routes for every template', () => {
    for (const id of ROUTE_TEMPLATE_IDS) {
      const l = buildRoute(id, { x: -9, y: -1 });
      const r = buildRoute(id, { x: 9, y: -1 });
      expect(l.path).toHaveLength(r.path.length);
      l.path.forEach((p, i) => {
        expect(p.x).toBeCloseTo(-r.path[i]!.x, 10);
        expect(p.y).toBeCloseTo(r.path[i]!.y, 10);
      });
    }
  });
});

describe('route templates', () => {
  it('has a template for every id with matching id', () => {
    for (const id of ROUTE_TEMPLATE_IDS) {
      expect(ROUTE_TEMPLATES[id].id).toBe(id);
      expect(isRouteTemplateId(id)).toBe(true);
    }
    expect(isRouteTemplateId('nope')).toBe(false);
  });

  it('every template builds a well-formed route', () => {
    for (const id of ROUTE_TEMPLATE_IDS) {
      const t = ROUTE_TEMPLATES[id];
      const route = buildRoute(id, { x: 6, y: -1 });
      expect(route.type).toBe('route');
      expect(route.path).toHaveLength(SHAPE_LENGTH[id]);
      expect(route.smooth).toHaveLength(route.path.length);
      expect(route.templateId).toBe(id);
      expect(route.endBehavior).toBe(t.endBehavior);
      expect(route.delay).toBeUndefined();
      expect(t.minDepth).toBeLessThanOrEqual(t.defaultDepth);
      expect(t.defaultDepth).toBeLessThanOrEqual(t.maxDepth);
    }
  });

  it('stop routes are exactly hitch, curl, comeback', () => {
    const stops = ROUTE_TEMPLATE_IDS.filter((id) => ROUTE_TEMPLATES[id].endBehavior === 'stop');
    expect([...stops].sort()).toEqual([...STOP_IDS].sort());
  });

  it('smooth flags follow the template (flat, drag, wheel)', () => {
    expect(buildRoute('flat', { x: 5, y: 0 }).smooth).toEqual([true, false]);
    expect(buildRoute('drag', { x: 5, y: 0 }).smooth).toEqual([true, false]);
    expect(buildRoute('wheel', { x: 5, y: 0 }).smooth).toEqual([true, true, false]);
    expect(buildRoute('slant', { x: 5, y: 0 }).smooth).toEqual([false, false]);
  });

  it('builds the exact slant shape from the right', () => {
    const route = buildRoute('slant', { x: 10, y: -1 });
    expect(route.path).toEqual([
      { x: 10, y: 2 },
      { x: 4, y: 8 },
    ]);
  });

  it('builds the exact go and sluggo shapes from the left', () => {
    expect(buildRoute('go', { x: -10, y: -1 }).path).toEqual([{ x: -10, y: 14 }]);
    expect(buildRoute('sluggo', { x: -10, y: 0 }).path).toEqual([
      { x: -10, y: 3 },
      { x: -7.5, y: 5.5 },
      { x: -7.5, y: 20 },
    ]);
  });

  it('wheel keeps its first two points independent of depth', () => {
    const a = buildRoute('wheel', { x: 10, y: 0 }, { depth: 8 });
    const b = buildRoute('wheel', { x: 10, y: 0 }, { depth: 20 });
    expect(a.path.slice(0, 2)).toEqual(b.path.slice(0, 2));
    expect(a.path[2]!.y).toBe(8);
    expect(b.path[2]!.y).toBe(20);
  });

  it('never emits -0 coordinates', () => {
    for (const id of ROUTE_TEMPLATE_IDS) {
      for (const sx of [-8, 0, 8]) {
        const route = buildRoute(id, { x: sx, y: 0 }, { outward: -1 });
        for (const p of route.path) {
          expect(Object.is(p.x, -0)).toBe(false);
          expect(Object.is(p.y, -0)).toBe(false);
        }
      }
    }
    expect(Object.is(buildRoute('go', { x: 0, y: 0 }, { outward: -1 }).path[0]!.x, 0)).toBe(true);
  });

  it('uses the default depth when omitted', () => {
    const route = buildRoute('out', { x: 8, y: 0 });
    expect(route.path[0]).toEqual({ x: 8, y: ROUTE_TEMPLATES.out.defaultDepth });
  });

  it('clamps depth below min and above max', () => {
    const t = ROUTE_TEMPLATES.post;
    expect(buildRoute('post', { x: 8, y: 0 }, { depth: 1 }).path[0]!.y).toBe(t.minDepth);
    expect(buildRoute('post', { x: 8, y: 0 }, { depth: 99 }).path[0]!.y).toBe(t.maxDepth);
    expect(buildRoute('post', { x: 8, y: 0 }, { depth: 12 }).path[0]!.y).toBe(12);
  });

  it('does not repeat the start point in the path', () => {
    const start = { x: -7, y: -1 };
    for (const id of ROUTE_TEMPLATE_IDS) {
      const route = buildRoute(id, start);
      expect(route.path.some((p) => p.x === start.x && p.y === start.y)).toBe(false);
    }
  });
});

describe('outwardSign', () => {
  it('is +1 right of the ball and -1 left of the ball', () => {
    expect(outwardSign({ x: 5, y: 0 })).toBe(1);
    expect(outwardSign({ x: -5, y: 0 })).toBe(-1);
    expect(outwardSign({ x: 5, y: 0 }, 'left')).toBe(1);
    expect(outwardSign({ x: -5, y: 0 }, 'right')).toBe(-1);
  });

  it('uses the strong side for a receiver on the ball', () => {
    expect(outwardSign({ x: 0, y: 0 })).toBe(1);
    expect(outwardSign({ x: 0, y: 0 }, 'right')).toBe(1);
    expect(outwardSign({ x: 0, y: 0 }, 'left')).toBe(-1);
    expect(outwardSign({ x: 0.2, y: 0 }, 'left')).toBe(-1);
    expect(outwardSign({ x: -0.2, y: 0 }, 'right')).toBe(1);
  });

  it('treats the 0.25 threshold as outside the center band', () => {
    expect(outwardSign({ x: 0.25, y: 0 }, 'left')).toBe(1);
    expect(outwardSign({ x: -0.25, y: 0 }, 'right')).toBe(-1);
  });

  it('the outward option overrides the start position', () => {
    const left = buildRoute('out', { x: -8, y: 0 }, { outward: 1 });
    expect(left.path[1]!.x).toBeGreaterThan(-8);
  });
});

describe('localToField', () => {
  it('maps out/up to absolute points and honors outward', () => {
    const pts = [
      { out: 2, up: 3 },
      { out: -1, up: 5, smooth: true },
    ];
    expect(localToField({ x: 4, y: 1 }, 1, pts)).toEqual([
      { x: 6, y: 4 },
      { x: 3, y: 6 },
    ]);
    expect(localToField({ x: -4, y: 1 }, -1, pts)).toEqual([
      { x: -6, y: 4 },
      { x: -3, y: 6 },
    ]);
  });
});
