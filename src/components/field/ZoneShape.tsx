/**
 * Translucent zone polygon (§12.2 "Vùng màu trong suốt, mỗi loại zone một màu") + drop point handle.
 * Colours by ZoneKind: deep blue, flat amber, hook green, curl teal, custom grey. Points in yards.
 */
import type { Point } from '@/domain/types';
import type { ZoneKind } from '@/domain/zones';

export interface ZoneShapeProps {
  polygon: readonly Point[];
  kind: ZoneKind;
  dropPoint?: Point;
  /** Drop point handle: data-kind="dropPoint" data-slot-id for editor hit-testing. */
  slotId?: string;
  showDropHandle?: boolean;
  selected?: boolean;
  testId?: string;
}

export function ZoneShape(_props: ZoneShapeProps): JSX.Element | null {
  return null;
}
