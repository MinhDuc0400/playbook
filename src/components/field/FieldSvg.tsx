/**
 * Field drawing (FR-FLD-01): sidelines, LOS, a line every 5 yd, end zones, rush line,
 * line-to-gain, no-run zones + "Chỉ được chuyền" badge when the ball is in one.
 * Renders an <svg> of viewport size; children are drawn on top inside FieldContext.
 */
import { useMemo, type ReactNode } from 'react';
import { fieldBounds, goalLineY, isInNoRunZone, yardLineToY } from '@/domain/field';
import type { BallSpot, FieldConfig } from '@/domain/types';
import { t } from '@/i18n/vi';
import { FieldContext } from './FieldContext';
import { toScreen, yardsToPx, type Viewport } from './viewport';

export interface FieldSvgProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  viewport: Viewport;
  /** 'contrast' = high-contrast projector theme (FR-IN-05). */
  theme?: 'normal' | 'contrast';
  showGrid?: boolean;
  /** Prefix for every data-testid (the mini-map uses one so ids stay unique). */
  testIdPrefix?: string;
  className?: string;
  children?: ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

interface Palette {
  surface: string;
  endZone: string;
  yardLine: string;
  goalLine: string;
  sideline: string;
  grid: string;
  noRun: string;
  lineToGain: string;
  rushLine: string;
  los: string;
  badgeBg: string;
  badgeText: string;
  /** stroke widths in px */
  w: { yard: number; goal: number; side: number; grid: number; ltg: number; rush: number; los: number };
}

const NORMAL: Palette = {
  surface: 'fill-emerald-100 dark:fill-emerald-950',
  endZone: 'fill-emerald-300 dark:fill-emerald-900',
  yardLine: 'stroke-emerald-800/50 dark:stroke-emerald-200/40',
  goalLine: 'stroke-emerald-900 dark:stroke-emerald-100',
  sideline: 'stroke-emerald-900 dark:stroke-emerald-100',
  grid: 'stroke-emerald-800/15 dark:stroke-emerald-200/15',
  noRun: 'fill-red-500/20 dark:fill-red-400/25',
  lineToGain: 'stroke-yellow-500',
  rushLine: 'stroke-red-600 dark:stroke-red-400',
  los: 'stroke-blue-600 dark:stroke-blue-400',
  badgeBg: 'fill-amber-400',
  badgeText: 'fill-black',
  w: { yard: 1, goal: 2.5, side: 2.5, grid: 0.5, ltg: 3, rush: 2, los: 3 },
};

const CONTRAST: Palette = {
  surface: 'fill-black',
  endZone: 'fill-neutral-800',
  yardLine: 'stroke-white/80',
  goalLine: 'stroke-white',
  sideline: 'stroke-white',
  grid: 'stroke-white/25',
  noRun: 'fill-red-500/40',
  lineToGain: 'stroke-yellow-300',
  rushLine: 'stroke-red-400',
  los: 'stroke-sky-300',
  badgeBg: 'fill-yellow-300',
  badgeText: 'fill-black',
  w: { yard: 2, goal: 4, side: 4, grid: 1, ltg: 5, rush: 3.5, los: 5 },
};

const YARD_STEP = 5;
const BADGE_FONT_PX = 13;

export function FieldSvg({
  field,
  ballSpot,
  viewport,
  theme = 'normal',
  showGrid = false,
  testIdPrefix = '',
  className,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
}: FieldSvgProps): JSX.Element {
  const tp = testIdPrefix;
  const pal = theme === 'contrast' ? CONTRAST : NORMAL;
  const ctx = useMemo(() => ({ viewport, field, ballSpot }), [viewport, field, ballSpot]);

  const b = fieldBounds(field, ballSpot);
  const ownGoalY = yardLineToY(ballSpot, 0);
  const oppGoalY = goalLineY(field, ballSpot);

  /** Axis-aligned rect given in field yards → svg rect attributes. */
  const rect = (minX: number, maxX: number, minY: number, maxY: number) => {
    const tl = toScreen({ x: minX, y: maxY }, viewport);
    return {
      x: tl.x,
      y: tl.y,
      width: yardsToPx(maxX - minX, viewport),
      height: yardsToPx(maxY - minY, viewport),
    };
  };
  /** Horizontal line across the full width at field y. */
  const hLine = (y: number) => {
    const a = toScreen({ x: b.minX, y }, viewport);
    const c = toScreen({ x: b.maxX, y }, viewport);
    return { x1: a.x, y1: a.y, x2: c.x, y2: c.y };
  };

  const yardLines: number[] = [];
  for (let n = 0; n <= field.length; n += YARD_STEP) yardLines.push(n);
  if (yardLines[yardLines.length - 1] !== field.length) yardLines.push(field.length);

  const gridXs: number[] = [];
  for (let x = Math.ceil(b.minX); x <= b.maxX; x += 1) gridXs.push(x);
  const gridYs: number[] = [];
  for (let y = Math.ceil(b.minY); y <= b.maxY; y += 1) gridYs.push(y);

  const showBadge = isInNoRunZone(field, ballSpot);
  const badgeText = t.field.noRunBadge;
  const badgeW = badgeText.length * (BADGE_FONT_PX * 0.55) + 16;
  const badgeH = BADGE_FONT_PX + 10;
  const badgeAnchor = toScreen({ x: b.minX, y: 0 }, viewport);
  const badgeX = badgeAnchor.x + 8;
  const badgeY = badgeAnchor.y - badgeH - 6;

  return (
    <svg
      data-testid={`${tp}field-svg`}
      data-theme={theme}
      role="group"
      aria-label={t.field.ariaLabel}
      width={viewport.width}
      height={viewport.height}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      className={`block touch-none select-none ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <FieldContext.Provider value={ctx}>
        <g pointerEvents="none">
          <rect
            data-testid={`${tp}field-surface`}
            className={pal.surface}
            {...rect(b.minX, b.maxX, b.minY, b.maxY)}
          />
          <rect
            data-testid={`${tp}end-zone-own`}
            className={pal.endZone}
            {...rect(b.minX, b.maxX, b.minY, ownGoalY)}
          />
          <rect
            data-testid={`${tp}end-zone-opp`}
            className={pal.endZone}
            {...rect(b.minX, b.maxX, oppGoalY, b.maxY)}
          />

          {showGrid &&
            gridXs.map((x) => {
              const a = toScreen({ x, y: b.minY }, viewport);
              const c = toScreen({ x, y: b.maxY }, viewport);
              return (
                <line
                  key={`gx${x}`}
                  data-testid={`${tp}grid-line`}
                  className={pal.grid}
                  strokeWidth={pal.w.grid}
                  x1={a.x}
                  y1={a.y}
                  x2={c.x}
                  y2={c.y}
                />
              );
            })}
          {showGrid &&
            gridYs.map((y) => (
              <line
                key={`gy${y}`}
                data-testid={`${tp}grid-line`}
                className={pal.grid}
                strokeWidth={pal.w.grid}
                {...hLine(y)}
              />
            ))}

          {yardLines.map((n) => {
            const isGoal = n === 0 || n === field.length;
            return (
              <line
                key={`yl${n}`}
                data-testid={`${tp}yardline-${n}`}
                className={isGoal ? pal.goalLine : pal.yardLine}
                strokeWidth={isGoal ? pal.w.goal : pal.w.yard}
                {...hLine(yardLineToY(ballSpot, n))}
              />
            );
          })}

          {[b.minX, b.maxX].map((x, i) => {
            const a = toScreen({ x, y: b.minY }, viewport);
            const c = toScreen({ x, y: b.maxY }, viewport);
            return (
              <line
                key={`sl${i}`}
                data-testid={`${tp}sideline`}
                className={pal.sideline}
                strokeWidth={pal.w.side}
                x1={a.x}
                y1={a.y}
                x2={c.x}
                y2={c.y}
              />
            );
          })}

          {field.noRunZones.map((z, i) => (
            <rect
              key={`nr${i}`}
              data-testid={`${tp}no-run-zone`}
              className={pal.noRun}
              {...rect(b.minX, b.maxX, yardLineToY(ballSpot, z.from), yardLineToY(ballSpot, z.to))}
            />
          ))}

          {field.lineToGain.map((n) => (
            <line
              key={`ltg${n}`}
              data-testid={`${tp}line-to-gain`}
              className={pal.lineToGain}
              strokeWidth={pal.w.ltg}
              {...hLine(yardLineToY(ballSpot, n))}
            />
          ))}

          <line
            data-testid={`${tp}rush-line`}
            className={pal.rushLine}
            strokeWidth={pal.w.rush}
            strokeDasharray="8 6"
            {...hLine(field.rushLine)}
          />
          <line data-testid={`${tp}los`} className={pal.los} strokeWidth={pal.w.los} {...hLine(0)} />

          {showBadge && (
            <g data-testid={`${tp}no-run-badge`}>
              <rect
                className={pal.badgeBg}
                x={badgeX}
                y={badgeY}
                width={badgeW}
                height={badgeH}
                rx={badgeH / 2}
              />
              <text
                className={pal.badgeText}
                x={badgeX + badgeW / 2}
                y={badgeY + badgeH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={BADGE_FONT_PX}
                fontWeight={600}
              >
                {badgeText}
              </text>
            </g>
          )}
        </g>
        {children}
      </FieldContext.Provider>
    </svg>
  );
}
