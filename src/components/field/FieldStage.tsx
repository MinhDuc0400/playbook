/**
 * Field + zoom/pan + "Vừa màn hình" button in a sized container. Used by Editor, Matchup, Present.
 */
import type { ReactNode } from 'react';
import type { BallSpot, FieldConfig } from '@/domain/types';
import type { FieldSvgProps } from './FieldSvg';

export interface FieldStageProps extends Omit<FieldSvgProps, 'viewport' | 'children'> {
  field: FieldConfig;
  ballSpot: BallSpot;
  children?: ReactNode;
  /** Extra controls rendered over the top-right corner next to the fit button. */
  overlayControls?: ReactNode;
}

export function FieldStage(_props: FieldStageProps): JSX.Element | null {
  return null;
}
