/** FR-MU-07: outcome, target, yards, time to throw, separation at throw per receiver, open-window bars. */
import type { Play, SimResult } from '@/domain/types';

export interface ResultPanelProps {
  result: SimResult;
  offense: Play; // for labels
  /** Current playhead, drawn on the open-window bars. */
  t: number;
}

export function ResultPanel(_props: ResultPanelProps): JSX.Element | null {
  return null;
}
