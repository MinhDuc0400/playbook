/**
 * Field drawing (FR-FLD-01): sidelines, LOS, a line every 5 yd, end zones, rush line,
 * line-to-gain, no-run zones + "Chỉ được chuyền" badge when the ball is in one.
 * Renders an <svg> of viewport size; children are drawn on top inside FieldContext.
 */
import type { ReactNode } from 'react';
import type { BallSpot, FieldConfig } from '@/domain/types';
import type { Viewport } from './viewport';

export interface FieldSvgProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  viewport: Viewport;
  /** 'contrast' = high-contrast projector theme (FR-IN-05). */
  theme?: 'normal' | 'contrast';
  showGrid?: boolean;
  className?: string;
  children?: ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

export function FieldSvg(_props: FieldSvgProps): JSX.Element | null {
  return null;
}
