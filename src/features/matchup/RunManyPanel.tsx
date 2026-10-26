/** FR-MU-13: "Chạy 50 lần" in the Worker — % complete, target distribution, avg yards, % sack, % int. */
import type { SimInput } from '@/domain/types';

export interface RunManyPanelProps {
  input: SimInput;
  /** slot id → label for display */
  labels: Record<string, string>;
}

export function RunManyPanel(_props: RunManyPanelProps): JSX.Element | null {
  return null;
}
