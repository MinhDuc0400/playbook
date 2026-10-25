/**
 * Editor store (D-14): Zustand + zundo temporal (undo ≥ 100 steps, FR-ED-04).
 * Only `play` is tracked by history; selection/tool/draft are UI state.
 */
import { notImplemented } from '@/domain/notImplemented';
import type { ID, Play, Point } from '@/domain/types';
import type { Recipe } from '@/features/editor/ops';
import type { ToolId } from '@/features/editor/tools/types';

export const HISTORY_LIMIT = 200;

export interface SelectedPoint {
  slotId: ID;
  index: number; // route path index
}

/** In-progress drawing owned by the active tool (e.g. route points being clicked). */
export type EditorDraft =
  | { kind: 'route'; slotId: ID; points: Point[]; smooth: boolean[]; cursor: Point | null }
  | { kind: 'polygon'; slotId: ID; points: Point[]; cursor: Point | null }
  | { kind: 'man'; slotId: ID }
  | { kind: 'generic'; data: Record<string, unknown> };

export interface EditorState {
  play: Play | null;
  selection: ID[];
  selectedPoint: SelectedPoint | null;
  tool: ToolId;
  draft: EditorDraft | null;
  /** Defense: ghost offense formation id (FR-DEF-01); null = default for the format. */
  ghostFormationId: string | null;
  previewing: boolean;

  /** Replace the play and clear history, selection and draft. */
  load(play: Play | null): void;
  /** Apply a recipe to the play (one undo step, label for debugging). No-op when play is null or unchanged. */
  apply(label: string, recipe: Recipe): void;
  /** Start a drag: later applies are merged into one undo step until endGesture(). */
  beginGesture(): void;
  endGesture(): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  setTool(tool: ToolId): void;
  select(ids: ID[]): void;
  setSelectedPoint(p: SelectedPoint | null): void;
  setDraft(d: EditorDraft | null): void;
  setGhostFormation(id: string | null): void;
  setPreviewing(v: boolean): void;
}

/** React hook + vanilla API (`useEditorStore.getState()`, `.setState`, `.subscribe`). */
export const useEditorStore = new Proxy(
  (() => notImplemented('useEditorStore')) as unknown as EditorStoreHook,
  {
    get: (_t, key) => notImplemented(`useEditorStore.${String(key)}`),
  },
);

export interface EditorStoreHook {
  <T>(selector: (s: EditorState) => T): T;
  getState(): EditorState;
  setState(partial: Partial<EditorState>): void;
  subscribe(listener: (s: EditorState, prev: EditorState) => void): () => void;
}
