/**
 * Field + zoom/pan + "Vừa màn hình" button in a sized container. Used by Editor, Matchup, Present.
 */
import { useCallback, useRef, type ReactNode } from 'react';
import type { BallSpot, FieldConfig } from '@/domain/types';
import { t } from '@/i18n/vi';
import { FieldSvg, type FieldSvgProps } from './FieldSvg';
import { useZoomPan } from './useZoomPan';
import { defaultViewport } from './viewport';

export interface FieldStageProps extends Omit<FieldSvgProps, 'viewport' | 'children'> {
  field: FieldConfig;
  ballSpot: BallSpot;
  children?: ReactNode;
  /** Extra controls rendered over the top-right corner next to the fit button. */
  overlayControls?: ReactNode;
}

export function FieldStage({
  field,
  ballSpot,
  children,
  overlayControls,
  className,
  ...svgProps
}: FieldStageProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const makeFit = useCallback(
    (w: number, h: number) => defaultViewport(w, h, field, ballSpot),
    [field, ballSpot],
  );
  const { viewport, fit, panning } = useZoomPan(containerRef, makeFit);

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
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {overlayControls}
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
