/**
 * Player token (§12.2): offense = circle with the label inside; defense = triangle with the label beside;
 * ring colour by level (FR-ATH-02: weak red, avg grey, good green, custom purple); rusher hand; leverage dot;
 * progression badge. Position via toScreen from FieldContext.
 */
import type { ID, Leverage, Point, Preset, Side } from '@/domain/types';
import { useFieldContext } from './FieldContext';
import { toScreen, yardsToPx } from './viewport';

export interface PlayerTokenProps {
  id: ID;
  side: Side;
  label: string;
  pos: Point; // yards
  selected?: boolean;
  /** Ring colour; omitted → no ring. */
  level?: Preset | 'custom';
  /** Defense: small dot offset toward inside/outside (needs `insideSign`: +1 when inside is +x). */
  leverage?: Leverage;
  insideSign?: 1 | -1;
  /** Designated rusher: raised-hand marker (FR-DEF-04). */
  rusher?: boolean;
  /** Ghost offense in the defense editor: faded, not draggable. */
  ghost?: boolean;
  /** Progression order badge 1, 2, 3… (FR-OFF-04). */
  progressionIndex?: number;
  dimmed?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export const RING_COLORS: Record<Preset | 'custom', string> = {
  weak: '#dc2626',
  avg: '#9ca3af',
  good: '#16a34a',
  custom: '#9333ea',
};

const TOKEN_RADIUS_YD = 0.9;
const LABEL_FONT_YD = 0.9;
const LEVERAGE_OFFSET_YD = 0.6;
const GHOST_OPACITY = 0.35;
const DIMMED_OPACITY = 0.45;
const RING_WIDTH = 3;
const RING_WIDTH_SELECTED = 4.5;
const HIGHLIGHT = '#f59e0b';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function PlayerToken({
  id,
  side,
  label,
  pos,
  selected = false,
  level,
  leverage,
  insideSign = 1,
  rusher = false,
  ghost = false,
  progressionIndex,
  dimmed = false,
  onPointerDown,
}: PlayerTokenProps): JSX.Element {
  const { viewport } = useFieldContext();
  const c = toScreen(pos, viewport);
  const r = clamp(yardsToPx(TOKEN_RADIUS_YD, viewport), 6, 22);
  const fontSize = clamp(yardsToPx(LABEL_FONT_YD, viewport), 9, 16);
  const isOffense = side === 'offense';

  const ringColor = level ? RING_COLORS[level] : undefined;
  const bodyProps = {
    'data-part': 'body',
    stroke: ringColor ?? 'none',
    strokeWidth: selected ? RING_WIDTH_SELECTED : RING_WIDTH,
    className: isOffense ? 'fill-blue-600 dark:fill-blue-500' : 'fill-rose-700 dark:fill-rose-600',
  };

  // Defense triangle points toward the offense (screen down).
  const trianglePoints = [
    `${c.x},${c.y + r * 1.1}`,
    `${c.x - r},${c.y - r * 0.9}`,
    `${c.x + r},${c.y - r * 0.9}`,
  ].join(' ');

  const dotOffset = yardsToPx(LEVERAGE_OFFSET_YD, viewport);
  let dot: { x: number; y: number } | null = null;
  if (!isOffense && leverage) {
    if (leverage === 'inside') dot = { x: c.x + insideSign * dotOffset, y: c.y };
    else if (leverage === 'outside') dot = { x: c.x - insideSign * dotOffset, y: c.y };
    else dot = { x: c.x, y: c.y + dotOffset }; // head-up: toward the offense (−y field = screen down)
  }

  const badgeR = Math.max(6, r * 0.55);
  const opacity = ghost ? GHOST_OPACITY : dimmed ? DIMMED_OPACITY : undefined;

  const identity = ghost
    ? { 'data-testid': `ghost-${label}`, 'data-kind': 'ghost', 'data-ghost-id': id }
    : { 'data-testid': `token-${label}`, 'data-kind': 'player', 'data-slot-id': id };

  return (
    <g
      {...identity}
      role="img"
      aria-label={label}
      opacity={opacity}
      pointerEvents={ghost ? 'none' : undefined}
      className={ghost ? undefined : 'cursor-pointer'}
      onPointerDown={ghost ? undefined : onPointerDown}
    >
      {selected && (
        <circle
          data-part="selection"
          cx={c.x}
          cy={c.y}
          r={r + 5}
          fill="none"
          stroke={HIGHLIGHT}
          strokeWidth={3}
        />
      )}

      {isOffense ? (
        <circle cx={c.x} cy={c.y} r={r} {...bodyProps} />
      ) : (
        <polygon points={trianglePoints} strokeLinejoin="round" {...bodyProps} />
      )}

      {isOffense ? (
        <text
          x={c.x}
          y={c.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={700}
          className="fill-white"
          pointerEvents="none"
        >
          {label}
        </text>
      ) : (
        <text
          x={c.x + r + 4}
          y={c.y}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={700}
          className="fill-slate-900 dark:fill-slate-100"
          pointerEvents="none"
        >
          {label}
        </text>
      )}

      {dot && (
        <circle
          data-testid="leverage-dot"
          cx={dot.x}
          cy={dot.y}
          r={Math.max(2, r * 0.22)}
          className="fill-white"
          pointerEvents="none"
        />
      )}

      {rusher && (
        <g data-testid="rusher-mark" pointerEvents="none">
          <line
            x1={c.x}
            y1={c.y - r * 0.9}
            x2={c.x}
            y2={c.y - r * 1.8}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="text-rose-700 dark:text-rose-400"
          />
          <circle
            cx={c.x}
            cy={c.y - r * 2.1}
            r={Math.max(2.5, r * 0.3)}
            className="fill-rose-700 dark:fill-rose-400"
          />
        </g>
      )}

      {progressionIndex !== undefined && (
        <g data-testid="progression-badge" pointerEvents="none">
          <circle
            cx={c.x + r * 0.85}
            cy={c.y - r * 0.85}
            r={badgeR}
            className="fill-amber-400 stroke-slate-900"
            strokeWidth={1}
          />
          <text
            x={c.x + r * 0.85}
            y={c.y - r * 0.85}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.max(8, badgeR * 1.2)}
            fontWeight={700}
            className="fill-slate-900"
          >
            {progressionIndex}
          </text>
        </g>
      )}
    </g>
  );
}
