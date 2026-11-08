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
  /** Line labels (LOS, 1st down, Rush), yard numbers on the right sideline and the ball (D-30). */
  labels?: boolean;
  /** The static ball on the LOS; off wherever the ball is animated or the snap is over (D-37). Needs `labels`. */
  ballMarker?: boolean;
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
  yardText: string;
  ball: string;
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
  yardText: 'fill-emerald-900/70 dark:fill-emerald-100/60',
  ball: 'fill-amber-700 stroke-amber-950',
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
  yardText: 'fill-white/80',
  ball: 'fill-amber-500 stroke-white',
  w: { yard: 2, goal: 4, side: 4, grid: 1, ltg: 5, rush: 3.5, los: 5 },
};

const YARD_STEP = 5;
const BADGE_FONT_PX = 13;
const LABEL_FONT_PX = 11;
const BALL_RX_YD = 0.3;
const BALL_RY_YD = 0.5;

/** Small pill with text, anchored at its left edge `x`, sitting above (`below` false) or under the line at `y`. */
function LinePill({
  x,
  y,
  below,
  text,
  testId,
  bg,
  fg,
}: {
  x: number;
  y: number;
  below: boolean;
  text: string;
  testId: string;
  bg: string;
  fg: string;
}): JSX.Element {
  const w = text.length * (LABEL_FONT_PX * 0.6) + 10;
  const h = LABEL_FONT_PX + 6;
  const top = below ? y + 3 : y - h - 3;
  return (
    <g data-testid={testId}>
      <rect className={bg} x={x} y={top} width={w} height={h} rx={h / 2} />
      <text
        className={fg}
        x={x + w / 2}
        y={top + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={LABEL_FONT_PX}
        fontWeight={700}
      >
        {text}
      </text>
    </g>
  );
}

export function FieldSvg({
  field,
  ballSpot,
  viewport,
  theme = 'normal',
  showGrid = false,
  labels = false,
  ballMarker = true,
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

  const contrast = theme === 'contrast';
  const leftX = toScreen({ x: b.minX, y: 0 }, viewport).x + 6;
  const rightX = toScreen({ x: b.maxX, y: 0 }, viewport).x - 6;
  const ballC = toScreen({ x: 0, y: 0 }, viewport);

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

          {labels && (
            <>
              {yardLines
                .filter((n) => n > 0 && n < field.length && n % 10 === 0)
                .map((n) => (
                  <text
                    key={`yn${n}`}
                    data-testid={`${tp}yard-number-${n}`}
                    className={pal.yardText}
                    x={rightX}
                    y={toScreen({ x: 0, y: yardLineToY(ballSpot, n) }, viewport).y - 4}
                    textAnchor="end"
                    fontSize={LABEL_FONT_PX}
                    fontWeight={600}
                  >
                    {Math.min(n, field.length - n)}
                  </text>
                ))}
              {field.lineToGain.map((n) => (
                <LinePill
                  key={`ltgl${n}`}
                  testId={`${tp}label-first-down`}
                  x={leftX}
                  y={toScreen({ x: 0, y: yardLineToY(ballSpot, n) }, viewport).y}
                  below={false}
                  text={t.field.firstDown}
                  bg="fill-yellow-400"
                  fg="fill-black"
                />
              ))}
              <LinePill
                testId={`${tp}label-rush`}
                x={leftX}
                y={toScreen({ x: 0, y: field.rushLine }, viewport).y}
                below={false}
                text={t.field.rushLine}
                bg={contrast ? 'fill-red-400' : 'fill-red-600'}
                fg={contrast ? 'fill-black' : 'fill-white'}
              />
              <LinePill
                testId={`${tp}label-los`}
                x={leftX}
                y={ballC.y}
                below
                text={t.field.los}
                bg={contrast ? 'fill-sky-300' : 'fill-blue-600'}
                fg={contrast ? 'fill-black' : 'fill-white'}
              />
              {ballMarker && (
                <g data-testid={`${tp}ball-marker`}>
                  <title>{t.field.ball}</title>
                  <ellipse
                    className={pal.ball}
                    strokeWidth={1.5}
                    cx={ballC.x}
                    cy={ballC.y}
                    rx={yardsToPx(BALL_RX_YD, viewport)}
                    ry={yardsToPx(BALL_RY_YD, viewport)}
                  />
                </g>
              )}
            </>
          )}

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
