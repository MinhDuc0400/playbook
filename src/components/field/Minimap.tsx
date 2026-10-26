/** Corner overview of the whole field with the visible area outlined; click/drag re-centres the main view. */
import { useMemo, useRef, type ReactNode } from 'react';
import { fieldBounds } from '@/domain/field';
import type { BallSpot, FieldConfig, Point } from '@/domain/types';
import { t } from '@/i18n/vi';
import { FieldSvg } from './FieldSvg';
import { fitViewport, toField, toScreen, visibleRect, type Viewport } from './viewport';

const MAP_WIDTH = 110;
const MAP_MAX_HEIGHT = 180;
const MAP_PADDING = 2;

export interface MinimapProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  /** The main view being shown. */
  viewport: Viewport;
  /** Asked to centre the main view on this field point (the caller clamps). */
  onCenter(p: Point): void;
  theme?: 'normal' | 'contrast';
  /** Drawn inside the minimap's FieldContext (dots etc.). */
  content?: ReactNode;
}

export function Minimap({ field, ballSpot, viewport, onCenter, theme, content }: MinimapProps): JSX.Element {
  const bounds = fieldBounds(field, ballSpot);
  const mini = useMemo<Viewport>(() => {
    const rw = bounds.maxX - bounds.minX;
    const rh = bounds.maxY - bounds.minY;
    const aspect = rh / Math.max(rw, 1e-6);
    let w = MAP_WIDTH;
    let h = w * aspect;
    if (h > MAP_MAX_HEIGHT) {
      h = MAP_MAX_HEIGHT;
      w = h / aspect;
    }
    return fitViewport(Math.round(w), Math.round(h), bounds, MAP_PADDING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  const dragging = useRef(false);

  const centreAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onCenter(toField({ x: e.clientX - r.left, y: e.clientY - r.top }, mini));
  };

  const vis = visibleRect(viewport);
  const tl = toScreen({ x: vis.minX, y: vis.maxY }, mini);
  const br = toScreen({ x: vis.maxX, y: vis.minY }, mini);

  return (
    <div
      data-testid="minimap"
      data-no-zoompan=""
      role="group"
      aria-label={t.field.minimap}
      className="overflow-hidden rounded-md border-2 border-slate-700/70 bg-white/60 shadow dark:border-slate-200/70 dark:bg-slate-900/60"
      style={{ width: mini.width, height: mini.height }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FieldSvg
        field={field}
        ballSpot={ballSpot}
        viewport={mini}
        theme={theme}
        showGrid={false}
        testIdPrefix="minimap-"
        className="cursor-pointer"
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            // capture is best-effort
          }
          centreAt(e);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (dragging.current) centreAt(e);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          dragging.current = false;
        }}
      >
        {content}
        <rect
          data-testid="minimap-view"
          x={tl.x}
          y={tl.y}
          width={Math.max(br.x - tl.x, 1)}
          height={Math.max(br.y - tl.y, 1)}
          className="fill-yellow-400/20 stroke-yellow-500"
          strokeWidth={2}
          pointerEvents="none"
        />
      </FieldSvg>
    </div>
  );
}
