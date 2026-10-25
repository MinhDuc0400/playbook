/**
 * Editor store (D-14): Zustand + zundo temporal (undo ≥ 100 steps, FR-ED-04).
 * Only `play` is tracked by history; selection/tool/draft are UI state.
 */
import { temporal, type TemporalState } from 'zundo';
import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand';
import type { ID, Play, Point } from '@/domain/types';
import { getRoute, type Recipe } from '@/features/editor/ops';
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

/** The slice of state tracked by undo/redo. */
interface HistorySlice {
  play: Play | null;
}

/** React hook + vanilla API (`useEditorStore.getState()`, `.setState`, `.subscribe`, `.temporal`). */
export type EditorStore = UseBoundStore<
  Mutate<StoreApi<EditorState>, [['temporal', StoreApi<TemporalState<HistorySlice>>]]>
>;

/** Base play of the gesture in progress (null = none). Single store, so module scope is fine. */
let gestureBase: Play | null = null;

/** Drop selection / selected point that no longer exist in `play`. Returns {} when nothing is stale. */
function pruneUi(
  play: Play | null,
  selection: ID[],
  selectedPoint: SelectedPoint | null,
): Partial<Pick<EditorState, 'selection' | 'selectedPoint'>> {
  const ids = new Set(play?.players.map((s) => s.id));
  const patch: Partial<Pick<EditorState, 'selection' | 'selectedPoint'>> = {};
  const kept = selection.filter((id) => ids.has(id));
  if (kept.length !== selection.length) patch.selection = kept;
  if (selectedPoint) {
    const route = play ? getRoute(play, selectedPoint.slotId) : undefined;
    if (!route || selectedPoint.index >= route.path.length) patch.selectedPoint = null;
  }
  return patch;
}

function pruneAfterHistory(): void {
  const { play, selection, selectedPoint } = useEditorStore.getState();
  const patch = pruneUi(play, selection, selectedPoint);
  if (Object.keys(patch).length > 0) useEditorStore.setState(patch);
}

export const useEditorStore: EditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      play: null,
      selection: [],
      selectedPoint: null,
      tool: 'select',
      draft: null,
      ghostFormationId: null,
      previewing: false,

      load: (play) => {
        const history = useEditorStore.temporal.getState();
        gestureBase = null;
        history.pause();
        set({ play, selection: [], selectedPoint: null, draft: null, previewing: false });
        history.clear();
        history.resume();
      },

      apply: (_label, recipe) => {
        const { play, selection, selectedPoint } = get();
        if (!play) return;
        const next = recipe(play);
        if (next === play) return;
        set({ play: next, ...pruneUi(next, selection, selectedPoint) });
      },

      beginGesture: () => {
        const { play } = get();
        if (gestureBase || !play) return;
        gestureBase = play;
        useEditorStore.temporal.getState().pause();
      },

      endGesture: () => {
        if (!gestureBase) return;
        const base = gestureBase;
        gestureBase = null;
        const final = get().play;
        const history = useEditorStore.temporal.getState();
        if (final === base) {
          history.resume();
          return;
        }
        set({ play: base }); // still paused: not recorded
        history.resume();
        set({ play: final }); // recorded: one step from base
      },

      undo: () => {
        if (gestureBase) return;
        useEditorStore.temporal.getState().undo();
        pruneAfterHistory();
      },

      redo: () => {
        if (gestureBase) return;
        useEditorStore.temporal.getState().redo();
        pruneAfterHistory();
      },

      canUndo: () => useEditorStore.temporal.getState().pastStates.length > 0,
      canRedo: () => useEditorStore.temporal.getState().futureStates.length > 0,

      setTool: (tool) => set({ tool }),
      select: (ids) => set({ selection: ids }),
      setSelectedPoint: (p) => set({ selectedPoint: p }),
      setDraft: (d) => set({ draft: d }),
      setGhostFormation: (id) => set({ ghostFormationId: id }),
      setPreviewing: (v) => set({ previewing: v }),
    }),
    {
      partialize: (s): HistorySlice => ({ play: s.play }),
      limit: HISTORY_LIMIT,
      equality: (a, b) => a.play === b.play,
    },
  ),
);
