/**
 * Field + zoom/pan + "Vừa màn hình" button in a sized container. Used by Editor, Matchup, Present.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { fieldBounds } from '@/domain/field';
import type { BallSpot, FieldConfig } from '@/domain/types';
import { t } from '@/i18n/vi';
import { FieldSvg, type FieldSvgProps } from './FieldSvg';
import { Minimap } from './Minimap';
import { useZoomPan } from './useZoomPan';
import { clampViewport, defaultViewport, viewportForCenter, visibleRect } from './viewport';

export interface FieldStageProps extends Omit<FieldSvgProps, 'viewport' | 'children'> {
  field: FieldConfig;
  ballSpot: BallSpot;
  children?: ReactNode;
  /** Extra controls rendered over the top-right corner next to the fit button. */
  overlayControls?: ReactNode;
  /** Drawn inside the corner mini-map (inside its FieldContext), e.g. player dots. */
  minimapContent?: () => ReactNode;
}

export function FieldStage({
  field,
  ballSpot,
  children,
  overlayControls,
  minimapContent,
  className,
  ...svgProps
}: FieldStageProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const makeFit = useCallback(
    (w: number, h: number) => defaultViewport(w, h, field, ballSpot),
    [field, ballSpot],
  );
  const bounds = useCallback(() => fieldBounds(field, ballSpot), [field, ballSpot]);
  const { viewport, setViewport, fit, zoomBy, panning } = useZoomPan(containerRef, makeFit, { bounds });
  const [minimapOpen, setMinimapOpen] = useState(true);

  const full = fieldBounds(field, ballSpot);
  const vis = viewport ? visibleRect(viewport) : null;
  const zoomed =
    !!vis &&
    (vis.maxX - vis.minX < full.maxX - full.minX - 1e-6 ||
      vis.maxY - vis.minY < full.maxY - full.minY - 1e-6);

  return (
    <div
      ref={containerRef}
      data-testid="field-stage"
      className={`relative h-full w-full touch-none overflow-hidden ${
        panning ? 'cursor-grab' : ''
      } ${className ?? ''}`}
    >
      {viewport && (
        <FieldSvg {...svgProps} field={field} ballSpot={ballSpot} viewport={viewport}>
          {children}
        </FieldSvg>
      )}
      {viewport && zoomed && minimapOpen && (
        <div data-no-zoompan="" className="absolute bottom-2 left-2">
          <Minimap
            field={field}
            ballSpot={ballSpot}
            viewport={viewport}
            theme={svgProps.theme}
            content={minimapContent?.()}
            onCenter={(p) => setViewport(clampViewport(viewportForCenter(viewport, p), full))}
          />
        </div>
      )}
      <div data-no-zoompan="" className="absolute right-2 top-2 flex items-center gap-2">
        {overlayControls}
        <button
          type="button"
          data-testid="btn-minimap"
          aria-label={t.field.minimapToggle}
          title={t.field.minimapToggle}
          aria-pressed={minimapOpen}
          onClick={() => setMinimapOpen((v) => !v)}
          className="rounded-md bg-white/90 px-2 py-1 text-sm text-slate-800 shadow hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <rect x="3.5" y="7" width="5" height="5" />
          </svg>
        </button>
        <button
          type="button"
          data-testid="btn-zoom-out"
          aria-label={t.field.zoomOut}
          title={t.field.zoomOut}
          onClick={() => zoomBy(1 / 1.25)}
          className="rounded-md bg-white/90 px-2 py-1 text-sm text-slate-800 shadow hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 8h10" />
          </svg>
        </button>
        <button
          type="button"
          data-testid="btn-zoom-in"
          aria-label={t.field.zoomIn}
          title={t.field.zoomIn}
          onClick={() => zoomBy(1.25)}
          className="rounded-md bg-white/90 px-2 py-1 text-sm text-slate-800 shadow hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
        <button
          type="button"
          data-testid="btn-fit"
          aria-label={t.field.fit}
          title={t.field.fit}
          onClick={fit}
          className="rounded-md bg-white/90 px-2 py-1 text-sm text-slate-800 shadow hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
