/**
 * Translucent zone polygon (§12.2 "Vùng màu trong suốt, mỗi loại zone một màu") + drop point handle.
 * Colours by ZoneKind: deep blue, flat amber, hook green, curl teal, custom grey. Points in yards.
 */
import type { Point } from '@/domain/types';
import type { ZoneKind } from '@/domain/zones';
import { useFieldContext } from './FieldContext';
import { toScreen } from './viewport';

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

export const ZONE_COLORS: Record<ZoneKind, string> = {
  deep: '#3b82f6',
  flat: '#f59e0b',
  hook: '#22c55e',
  curl: '#14b8a6',
  custom: '#9ca3af',
};

const FILL_OPACITY = 0.18;
const DROP_DOT_RADIUS = 3;
const DROP_HANDLE_RADIUS = 8;

export function ZoneShape({
  polygon,
  kind,
  dropPoint,
  slotId,
  showDropHandle = false,
  selected = false,
  testId,
}: ZoneShapeProps): JSX.Element | null {
  const { viewport } = useFieldContext();
  if (polygon.length === 0) return null;

  const color = ZONE_COLORS[kind];
  const points = polygon
    .map((p) => {
      const s = toScreen(p, viewport);
      return `${s.x},${s.y}`;
    })
    .join(' ');
  const drop = dropPoint ? toScreen(dropPoint, viewport) : null;

  return (
    <g
      data-testid={testId}
      data-zone-kind={kind}
      data-selected={selected ? 'true' : undefined}
      data-slot-id={slotId}
    >
      <polygon
        data-part="area"
        points={points}
        fill={color}
        fillOpacity={FILL_OPACITY}
        stroke={color}
        strokeWidth={selected ? 2 : 1}
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {drop && (
        <circle
          data-part="drop-dot"
          cx={drop.x}
          cy={drop.y}
          r={DROP_DOT_RADIUS}
          fill={color}
          pointerEvents="none"
        />
      )}
      {drop && showDropHandle && (
        <circle
          data-kind="dropPoint"
          data-slot-id={slotId}
          cx={drop.x}
          cy={drop.y}
          r={DROP_HANDLE_RADIUS}
          fill="white"
          fillOpacity={0.6}
          stroke={color}
          strokeWidth={2}
          className="cursor-grab"
        />
      )}
    </g>
  );
}
