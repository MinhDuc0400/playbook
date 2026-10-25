/** SVG path builders in SCREEN space (inputs already converted with toScreen). Pure. */
import type { ScreenPoint } from './viewport';

const DEFAULT_CORNER_RADIUS = 18;
const DEFAULT_AMPLITUDE = 3;
const DEFAULT_WAVELENGTH = 8;
const DEFAULT_ARROW_SIZE = 8;
const EPS = 1e-9;

/** Round to 2 decimals (keeps path strings short and stable) and drop `-0`. */
function f(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

function xy(p: ScreenPoint): string {
  return `${f(p.x)} ${f(p.y)}`;
}

/**
 * Polyline through pts; vertices i (1 ≤ i ≤ n−2) with smooth[i−1] true are rounded with a quadratic
 * curve of radius ≤ cornerRadius px (smooth[] is per path point, pts[0] is the start). The start and
 * final point are never rounded. Hand-built M/L/Q string (no d3 needed).
 */
export function routePathD(
  pts: readonly ScreenPoint[],
  smooth: readonly boolean[],
  cornerRadius: number = DEFAULT_CORNER_RADIUS,
): string {
  const n = pts.length;
  if (n === 0) return '';
  const first = pts[0];
  if (!first) return '';
  const parts: string[] = [`M${xy(first)}`];
  for (let i = 1; i < n; i += 1) {
    const cur = pts[i];
    const prev = pts[i - 1];
    const next = pts[i + 1];
    if (!cur || !prev) continue;
    if (i <= n - 2 && next && smooth[i - 1] === true) {
      const inX = cur.x - prev.x;
      const inY = cur.y - prev.y;
      const outX = next.x - cur.x;
      const outY = next.y - cur.y;
      const inLen = Math.hypot(inX, inY);
      const outLen = Math.hypot(outX, outY);
      const cut = Math.min(Math.max(cornerRadius, 0), inLen / 2, outLen / 2);
      if (cut > EPS) {
        const a = { x: cur.x - (inX / inLen) * cut, y: cur.y - (inY / inLen) * cut };
        const b = { x: cur.x + (outX / outLen) * cut, y: cur.y + (outY / outLen) * cut };
        parts.push(`L${xy(a)}`, `Q${xy(cur)} ${xy(b)}`);
        continue;
      }
    }
    parts.push(`L${xy(cur)}`);
  }
  return parts.join(' ');
}

/** Zigzag polyline along pts (motion, §12.2 "Nét đứt zigzag"): amplitude px, wavelength px. */
export function zigzagD(
  pts: readonly ScreenPoint[],
  amplitude: number = DEFAULT_AMPLITUDE,
  wavelength: number = DEFAULT_WAVELENGTH,
): string {
  const first = pts[0];
  if (!first) return '';
  const last = pts[pts.length - 1] ?? first;

  // cumulative length at each vertex
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    cum.push((cum[i - 1] ?? 0) + (a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0));
  }
  const total = cum[cum.length - 1] ?? 0;
  const parts: string[] = [`M${xy(first)}`];
  const half = Math.max(wavelength / 2, 1e-3);

  let seg = 1;
  let sign = 1;
  for (let s = half; s < total - half * 0.5; s += half) {
    while (seg < pts.length - 1 && (cum[seg] ?? 0) < s) seg += 1;
    const a = pts[seg - 1];
    const b = pts[seg];
    if (!a || !b) break;
    const segLen = (cum[seg] ?? 0) - (cum[seg - 1] ?? 0);
    if (segLen < EPS) continue;
    const t = (s - (cum[seg - 1] ?? 0)) / segLen;
    const dx = (b.x - a.x) / segLen;
    const dy = (b.y - a.y) / segLen;
    const px = a.x + (b.x - a.x) * t - dy * amplitude * sign;
    const py = a.y + (b.y - a.y) * t + dx * amplitude * sign;
    parts.push(`L${f(px)} ${f(py)}`);
    sign = -sign;
  }
  if (total > EPS) parts.push(`L${xy(last)}`);
  return parts.join(' ');
}

/** Triangle arrowhead at the end of the last non-zero segment of pts, as an SVG `points` string. */
export function arrowHeadPoints(pts: readonly ScreenPoint[], size: number = DEFAULT_ARROW_SIZE): string {
  const tip = pts[pts.length - 1];
  if (!tip) return '';
  for (let i = pts.length - 1; i >= 1; i -= 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < EPS) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const bx = tip.x - ux * size;
    const by = tip.y - uy * size;
    const hw = size * 0.5;
    const p1 = { x: bx - uy * hw, y: by + ux * hw };
    const p2 = { x: bx + uy * hw, y: by - ux * hw };
    return `${xy(tip)} ${xy(p1)} ${xy(p2)}`;
  }
  return '';
}
