/** Editor tool plug-in interface (lead-owned). Tools are stateless; in-progress state lives in store.draft. */
import type { BallSpot, FieldConfig, ID, Point } from '@/domain/types';
import type { EditorState } from '@/store/editorStore';

export type ToolId = 'select' | 'place' | 'route' | 'man' | 'zone' | 'rush' | 'motion' | 'option';

/** What the pointer hit, resolved by the canvas from data attributes. */
export type HitTarget =
  | { kind: 'field' }
  | { kind: 'player'; slotId: ID; ghost?: false }
  | { kind: 'ghost'; ghostId: ID }
  | { kind: 'routePoint'; slotId: ID; index: number }
  | { kind: 'routeSegment'; slotId: ID; index: number } // insert position for the segment ending at path[index]
  | { kind: 'dropPoint'; slotId: ID };

export interface FieldPointerEvent {
  /** Field point, snapped to 0.5 yd unless Alt is held or ui.snap is off (FR-ED-03). */
  point: Point;
  /** Unsnapped field point. */
  raw: Point;
  target: HitTarget;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean; // ctrl or meta
  button: number;
  detail: number; // click count
}

export interface ToolContext {
  getState(): EditorState;
  field: FieldConfig;
  ballSpot: BallSpot;
  /** Max players for the play's format. */
  maxPlayers: number;
  idGen(): ID;
}

export interface EditorTool {
  id: ToolId;
  /** Keyboard shortcut (V, P, R, M, Z, B). */
  key?: string;
  cursor?: string;
  onPointerDown?(e: FieldPointerEvent, ctx: ToolContext): void;
  onPointerMove?(e: FieldPointerEvent, ctx: ToolContext): void;
  onPointerUp?(e: FieldPointerEvent, ctx: ToolContext): void;
  onDoubleClick?(e: FieldPointerEvent, ctx: ToolContext): void;
  /** Return true when handled (Enter/Esc/Delete…). */
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): boolean;
  /** Called when the tool is deactivated: clear its draft. */
  onDeactivate?(ctx: ToolContext): void;
}
