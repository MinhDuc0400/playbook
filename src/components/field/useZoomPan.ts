/** Zoom (wheel, pinch) and pan (Space + drag, or two-finger drag) state for a field (FR-FLD-03). */
import type { RefObject } from 'react';
import { notImplemented } from '@/domain/notImplemented';
import type { Viewport } from './viewport';

export interface ZoomPan {
  viewport: Viewport | null; // null until the container has been measured
  setViewport(vp: Viewport): void;
  /** Reset to the fit() viewport ("Vừa màn hình"). */
  fit(): void;
  /** True while Space is held (cursor should show grab and tools must ignore pointer events). */
  panning: boolean;
}

/**
 * Measures `containerRef` with ResizeObserver, builds the initial viewport with `makeFit(w, h)`,
 * handles wheel zoom around the cursor, pinch zoom, and Space+drag pan on the container.
 */
export function useZoomPan(
  containerRef: RefObject<HTMLElement>,
  makeFit: (width: number, height: number) => Viewport,
): ZoomPan {
  return notImplemented(`useZoomPan ${String(containerRef)}${String(makeFit)}`);
}
