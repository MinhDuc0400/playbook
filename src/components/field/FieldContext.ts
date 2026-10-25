/** Viewport context shared by everything drawn inside a FieldSvg. Lead-owned wiring. */
import { createContext, useContext } from 'react';
import type { BallSpot, FieldConfig } from '@/domain/types';
import type { Viewport } from './viewport';

export interface FieldContextValue {
  viewport: Viewport;
  field: FieldConfig;
  ballSpot: BallSpot;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue {
  const v = useContext(FieldContext);
  if (!v) throw new Error('useFieldContext must be used inside <FieldSvg>');
  return v;
}
