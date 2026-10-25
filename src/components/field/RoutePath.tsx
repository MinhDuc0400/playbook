/**
 * Path drawing (§12.2): route = solid with arrow (primary = progression #1, bolder); motion = dashed zigzag;
 * option branches = dashed with 'M' / 'Z' label; man = thin dashed defender→receiver; rush = bold arrow
 * toward the QB; trail = actual run trace; ball = ball flight. Points in yards, converted via FieldContext.
 */
import type { Point } from '@/domain/types';
import { useFieldContext } from './FieldContext';
import { arrowHeadPoints, routePathD, zigzagD } from './paths';
import { toScreen, type ScreenPoint } from './viewport';

export type PathVariant =
  'route' | 'motion' | 'option-man' | 'option-zone' | 'man' | 'rush' | 'trail' | 'ball';

export interface RoutePathProps {
  from: Point;
  path: readonly Point[];
  smooth?: readonly boolean[];
  variant: PathVariant;
  primary?: boolean;
  selected?: boolean;
  /** Show draggable handles on each path point (editor). */
  showHandles?: boolean;
  /** data-* hooks so the canvas can hit-test: rendered on the path group as data-slot-id. */
  slotId?: string;
  testId?: string;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

interface Style {
  className: string;
  width: number;
  dash?: string;
  arrow: boolean;
  opacity?: number;
  round?: boolean;
}

const STYLES: Record<PathVariant, Style> = {
  route: { className: 'text-blue-700 dark:text-blue-300', width: 2, arrow: true },
  motion: { className: 'text-amber-600 dark:text-amber-400', width: 2, dash: '6 4', arrow: false },
  'option-man': { className: 'text-purple-700 dark:text-purple-300', width: 2, dash: '6 4', arrow: false },
  'option-zone': { className: 'text-purple-700 dark:text-purple-300', width: 2, dash: '6 4', arrow: false },
  man: { className: 'text-rose-700 dark:text-rose-300', width: 1, dash: '4 3', arrow: false },
  rush: { className: 'text-red-600 dark:text-red-400', width: 3.5, arrow: true },
  trail: { className: 'text-slate-700 dark:text-slate-200', width: 1, arrow: false, opacity: 0.5 },
  ball: {
    className: 'text-orange-600 dark:text-orange-400',
    width: 2,
    dash: '1 5',
    arrow: false,
    round: true,
  },
};

const PRIMARY_WIDTH = 3.5;
const HIT_WIDTH = 10;
const HANDLE_RADIUS = 5;
const HIGHLIGHT = '#f59e0b';
const OPTION_LABEL: Partial<Record<PathVariant, string>> = { 'option-man': 'M', 'option-zone': 'Z' };

/** Unit direction of the last non-zero segment (defaults to screen-up). */
function endDirection(pts: readonly ScreenPoint[]): ScreenPoint {
  for (let i = pts.length - 1; i >= 1; i -= 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > 1e-9) return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  }
  return { x: 0, y: -1 };
}

export function RoutePath({
  from,
  path,
  smooth,
  variant,
  primary = false,
  selected = false,
  showHandles = false,
  slotId,
  testId,
  onPointerDown,
}: RoutePathProps): JSX.Element | null {
  const { viewport } = useFieldContext();
  if (path.length === 0) return null;

  const pts: ScreenPoint[] = [from, ...path].map((p) => toScreen(p, viewport));
  const sm = smooth ?? [];
  const style = STYLES[variant];
  const width = primary && variant === 'route' ? PRIMARY_WIDTH : style.width;
  const d = variant === 'motion' ? zigzagD(pts) : routePathD(pts, sm);
  const optionLabel = OPTION_LABEL[variant];
  const end = pts[pts.length - 1];
  const dir = endDirection(pts);

  return (
    <g
      data-testid={testId}
      data-slot-id={slotId}
      data-variant={variant}
      data-selected={selected ? 'true' : undefined}
      className={style.className}
      onPointerDown={onPointerDown}
    >
      {selected && (
        <path
          data-part="selection"
          d={d}
          fill="none"
          stroke={HIGHLIGHT}
          strokeOpacity={0.55}
          strokeWidth={width + 5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      <path
        data-part="line"
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={style.dash}
        strokeOpacity={style.opacity}
        strokeLinecap={style.round ? 'round' : 'butt'}
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {style.arrow && (
        <polygon
          data-part="arrowhead"
          points={arrowHeadPoints(pts, 6 + width * 1.5)}
          fill="currentColor"
          fillOpacity={style.opacity}
          pointerEvents="none"
        />
      )}

      {optionLabel && end && (
        <text
          data-part="option-label"
          x={end.x + dir.x * 12}
          y={end.y + dir.y * 12}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fontWeight={700}
          fill="currentColor"
          pointerEvents="none"
        >
          {optionLabel}
        </text>
      )}

      {pts.slice(1).map((b, k) => {
        const a = pts[k];
        if (!a) return null;
        return (
          <path
            key={`seg${k}`}
            data-kind="routeSegment"
            data-index={k}
            d={`M${a.x} ${a.y} L${b.x} ${b.y}`}
            fill="none"
            stroke="transparent"
            strokeWidth={HIT_WIDTH}
            pointerEvents="stroke"
          />
        );
      })}

      {showHandles &&
        pts
          .slice(1)
          .map((p, j) =>
            sm[j] === true ? (
              <circle
                key={`pt${j}`}
                data-kind="routePoint"
                data-index={j}
                data-smooth="true"
                cx={p.x}
                cy={p.y}
                r={HANDLE_RADIUS}
                className="cursor-grab fill-white stroke-current"
                strokeWidth={2}
              />
            ) : (
              <rect
                key={`pt${j}`}
                data-kind="routePoint"
                data-index={j}
                data-smooth="false"
                x={p.x - HANDLE_RADIUS}
                y={p.y - HANDLE_RADIUS}
                width={HANDLE_RADIUS * 2}
                height={HANDLE_RADIUS * 2}
                className="cursor-grab fill-white stroke-current"
                strokeWidth={2}
              />
            ),
          )}
    </g>
  );
}
