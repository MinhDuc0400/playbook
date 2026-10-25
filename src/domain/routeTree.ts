/**
 * Route tree templates (FR-OFF-03). Templates are defined in a local frame:
 * `out` = yards toward the receiver's own sideline (negative = inside, toward the ball),
 * `up`  = yards downfield from the start. buildRoute() maps them to absolute field points,
 * so a template is automatically correct for a receiver on either side.
 */
import type { LateralSide, Point, RouteAction } from './types';

export type RouteTemplateId =
  | 'hitch'
  | 'slant'
  | 'out'
  | 'in'
  | 'go'
  | 'post'
  | 'corner'
  | 'curl'
  | 'comeback'
  | 'flat'
  | 'drag'
  | 'wheel'
  | 'whip'
  | 'out-and-up'
  | 'sluggo';

export const ROUTE_TEMPLATE_IDS: readonly RouteTemplateId[] = [
  'hitch',
  'slant',
  'out',
  'in',
  'go',
  'post',
  'corner',
  'curl',
  'comeback',
  'flat',
  'drag',
  'wheel',
  'whip',
  'out-and-up',
  'sluggo',
];

export interface LocalPoint {
  out: number;
  up: number;
  smooth?: boolean;
}

export interface RouteTemplate {
  id: RouteTemplateId;
  /** Depth (yd) of the main break used when none is given. */
  defaultDepth: number;
  minDepth: number;
  maxDepth: number;
  endBehavior: 'stop' | 'continue';
  /** Break points in the local frame for a given break depth (start point excluded). */
  shape(depth: number): LocalPoint[];
}

function template(
  id: RouteTemplateId,
  defaultDepth: number,
  minDepth: number,
  maxDepth: number,
  endBehavior: 'stop' | 'continue',
  shape: (depth: number) => LocalPoint[],
): RouteTemplate {
  return { id, defaultDepth, minDepth, maxDepth, endBehavior, shape };
}

export const ROUTE_TEMPLATES: Readonly<Record<RouteTemplateId, RouteTemplate>> = {
  hitch: template('hitch', 5, 3, 8, 'stop', (d) => [
    { out: 0, up: d + 1 },
    { out: -0.5, up: d },
  ]),
  slant: template('slant', 3, 1, 6, 'continue', (d) => [
    { out: 0, up: d },
    { out: -6, up: d + 6 },
  ]),
  out: template('out', 5, 3, 15, 'continue', (d) => [
    { out: 0, up: d },
    { out: 8, up: d },
  ]),
  in: template('in', 6, 4, 15, 'continue', (d) => [
    { out: 0, up: d },
    { out: -10, up: d },
  ]),
  go: template('go', 15, 5, 40, 'continue', (d) => [{ out: 0, up: d }]),
  post: template('post', 10, 6, 15, 'continue', (d) => [
    { out: 0, up: d },
    { out: -8, up: d + 8 },
  ]),
  corner: template('corner', 10, 6, 15, 'continue', (d) => [
    { out: 0, up: d },
    { out: 7, up: d + 7 },
  ]),
  curl: template('curl', 8, 5, 14, 'stop', (d) => [
    { out: 0, up: d },
    { out: -1.5, up: d - 2 },
  ]),
  comeback: template('comeback', 12, 8, 16, 'stop', (d) => [
    { out: 0, up: d },
    { out: 2, up: d - 3 },
  ]),
  flat: template('flat', 1, 0, 4, 'continue', (d) => [
    { out: 2, up: d + 1.5, smooth: true },
    { out: 8, up: d + 2 },
  ]),
  drag: template('drag', 2, 1, 5, 'continue', (d) => [
    { out: -1, up: d, smooth: true },
    { out: -14, up: d + 1 },
  ]),
  wheel: template('wheel', 12, 6, 25, 'continue', (d) => [
    { out: 4, up: 1.5, smooth: true },
    { out: 6, up: 4, smooth: true },
    { out: 6, up: d },
  ]),
  whip: template('whip', 3, 2, 6, 'continue', (d) => [
    { out: -2, up: d },
    { out: 8, up: d + 0.5 },
  ]),
  'out-and-up': template('out-and-up', 5, 3, 10, 'continue', (d) => [
    { out: 0, up: d },
    { out: 3, up: d },
    { out: 3, up: d + 15 },
  ]),
  sluggo: template('sluggo', 3, 2, 6, 'continue', (d) => [
    { out: 0, up: d },
    { out: -2.5, up: d + 2.5 },
    { out: -2.5, up: d + 17 },
  ]),
};

/** Avoid emitting -0 so equality checks and serialization stay stable. */
function norm(v: number): number {
  return v === 0 ? 0 : v;
}

export function isRouteTemplateId(id: string): id is RouteTemplateId {
  return (ROUTE_TEMPLATE_IDS as readonly string[]).includes(id);
}

/**
 * +1 when "outside" means +x (receiver right of the ball), −1 when it means −x.
 * A receiver on the ball (|x| < 0.25) faces the strong side (default right).
 */
export function outwardSign(start: Point, strongSide: LateralSide = 'right'): 1 | -1 {
  if (start.x >= 0.25) return 1;
  if (start.x <= -0.25) return -1;
  return strongSide === 'right' ? 1 : -1;
}

/** Map local template points to absolute field points for a receiver at `start`. */
export function localToField(start: Point, outward: 1 | -1, pts: readonly LocalPoint[]): Point[] {
  return pts.map((p) => ({
    x: norm(start.x + outward * p.out),
    y: norm(start.y + p.up),
  }));
}

/** Build a RouteAction from a template (templateId set, smooth flags filled, depth clamped). */
export function buildRoute(
  templateId: RouteTemplateId,
  start: Point,
  opts?: { depth?: number; outward?: 1 | -1 },
): RouteAction {
  const t = ROUTE_TEMPLATES[templateId];
  const depth = Math.min(t.maxDepth, Math.max(t.minDepth, opts?.depth ?? t.defaultDepth));
  const outward = opts?.outward ?? outwardSign(start);
  const local = t.shape(depth);
  return {
    type: 'route',
    path: localToField(start, outward, local),
    smooth: local.map((p) => p.smooth ?? false),
    templateId,
    endBehavior: t.endBehavior,
  };
}
