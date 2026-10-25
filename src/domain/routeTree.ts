/**
 * Route tree templates (FR-OFF-03). Templates are defined in a local frame:
 * `out` = yards toward the receiver's own sideline (negative = inside, toward the ball),
 * `up`  = yards downfield from the start. buildRoute() maps them to absolute field points,
 * so a template is automatically correct for a receiver on either side.
 */
import { notImplemented } from './notImplemented';
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

export const ROUTE_TEMPLATES: Readonly<Record<RouteTemplateId, RouteTemplate>> = new Proxy(
  {} as Record<RouteTemplateId, RouteTemplate>,
  {
    get: (_t, key) => notImplemented(`ROUTE_TEMPLATES.${String(key)}`),
  },
);

export function isRouteTemplateId(id: string): id is RouteTemplateId {
  return (ROUTE_TEMPLATE_IDS as readonly string[]).includes(id);
}

/**
 * +1 when "outside" means +x (receiver right of the ball), −1 when it means −x.
 * A receiver on the ball (|x| < 0.25) faces the strong side (default right).
 */
export function outwardSign(start: Point, strongSide: LateralSide = 'right'): 1 | -1 {
  return notImplemented(`outwardSign ${start.x}${strongSide}`);
}

/** Map local template points to absolute field points for a receiver at `start`. */
export function localToField(start: Point, outward: 1 | -1, pts: readonly LocalPoint[]): Point[] {
  return notImplemented(`localToField ${start.x}${outward}${pts.length}`);
}

/** Build a RouteAction from a template (templateId set, smooth flags filled, depth clamped). */
export function buildRoute(
  templateId: RouteTemplateId,
  start: Point,
  opts?: { depth?: number; outward?: 1 | -1 },
): RouteAction {
  return notImplemented(`buildRoute ${templateId}${start.x}${String(opts)}`);
}
