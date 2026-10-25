/**
 * Path drawing (§12.2): route = solid with arrow (primary = progression #1, bolder); motion = dashed zigzag;
 * option branches = dashed with 'M' / 'Z' label; man = thin dashed defender→receiver; rush = bold arrow
 * toward the QB; trail = actual run trace; ball = ball flight. Points in yards, converted via FieldContext.
 */
import type { Point } from '@/domain/types';

export type PathVariant =
  'route' | 'motion' | 'option-man' | 'option-zone' | 'man' | 'rush' | 'trail' | 'ball';

export interface RoutePathProps {
  from: Point;
  path: readonly Point[];
  smooth?: readonly boolean[];
  variant: PathVariant;
  primary?: boolean;
  selected?: boolean;
  /** Show draggable handles on each path point (editor). */
  showHandles?: boolean;
  /** data-* hooks so the canvas can hit-test: rendered on the path group as data-slot-id. */
  slotId?: string;
  testId?: string;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function RoutePath(_props: RoutePathProps): JSX.Element | null {
  return null;
}
