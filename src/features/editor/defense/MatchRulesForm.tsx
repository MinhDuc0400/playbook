/**
 * FR-DEF-07: per-defender rule list "Khi [receiver] [sự kiện] [sâu ≥ n yd] thì [phản ứng]", drag to reorder
 * (priority = list order), add / edit / delete.
 */
import type { ID } from '@/domain/types';

export interface MatchRulesFormProps {
  slotId: ID;
}

export function MatchRulesForm(_props: MatchRulesFormProps): JSX.Element | null {
  return null;
}
