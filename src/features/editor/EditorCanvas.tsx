/**
 * Editor field canvas (FR-ED-02/03, FR-OFF-01/02). Renders FieldStage + players, routes, draft and (defense)
 * GhostLayer/AssignmentLayer; turns pointer events into FieldPointerEvents for the active tool; handles
 * Enter/Esc/Delete/Backspace by forwarding to the active tool's onKeyDown.
 */
import type { BallSpot, FieldConfig } from '@/domain/types';

export interface EditorCanvasProps {
  field: FieldConfig;
  ballSpot: BallSpot;
  /** Settings.ui.snap (FR-ED-03); Alt still disables snapping when true. */
  snap: boolean;
  showGrid?: boolean;
}

export function EditorCanvas(_props: EditorCanvasProps): JSX.Element | null {
  return null;
}
