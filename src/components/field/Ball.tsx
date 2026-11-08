/** The ball token (animated: its position comes from engine frames, see displayBallPos). */
import type { Point } from '@/domain/types';
import { useFieldContext } from './FieldContext';
import { toScreen, yardsToPx } from './viewport';

export function Ball({ pos }: { pos: Point }): JSX.Element {
  const { viewport } = useFieldContext();
  const c = toScreen(pos, viewport);
  return (
    <circle
      data-testid="ball"
      cx={c.x}
      cy={c.y}
      r={Math.max(3, yardsToPx(0.35, viewport))}
      className="fill-amber-700 stroke-white"
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}
