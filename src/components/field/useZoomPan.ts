/** Zoom (wheel, pinch) and pan (Space + drag, or two-finger drag) state for a field (FR-FLD-03). */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { clampViewport, panBy, zoomAt, type RectLike, type ScreenPoint, type Viewport } from './viewport';

export interface ZoomPan {
  viewport: Viewport | null; // null until the container has been measured
  setViewport(vp: Viewport): void;
  /** Reset to the fit() viewport ("Vừa màn hình"). */
  fit(): void;
  /** Zoom by `factor` around the viewport centre (clamped). */
  zoomBy(factor: number): void;
  /** True while Space is held (cursor should show grab and tools must ignore pointer events). */
  panning: boolean;
}

/** Wheel sensitivity: factor = exp(-deltaY * WHEEL_SENSITIVITY). */
const WHEEL_SENSITIVITY = 0.0015;
const LINE_HEIGHT_PX = 16;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function isActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'BUTTON' || tag === 'A';
}

/**
 * Measures `containerRef` with ResizeObserver, builds the initial viewport with `makeFit(w, h)`,
 * handles wheel zoom around the cursor, pinch zoom, and Space+drag pan on the container.
 */
export function useZoomPan(
  containerRef: RefObject<HTMLElement>,
  makeFit: (width: number, height: number) => Viewport,
  opts?: { bounds?: () => RectLike },
): ZoomPan {
  const [viewport, setViewportState] = useState<Viewport | null>(null);
  const [panning, setPanningState] = useState(false);

  const viewportRef = useRef<Viewport | null>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const panningRef = useRef(false);
  const makeFitRef = useRef(makeFit);
  makeFitRef.current = makeFit;
  const boundsRef = useRef(opts?.bounds);
  boundsRef.current = opts?.bounds;

  const commit = useCallback((raw: Viewport) => {
    const bounds = boundsRef.current?.();
    const vp = bounds ? clampViewport(raw, bounds) : raw;
    viewportRef.current = vp;
    setViewportState(vp);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      if (vp) commit(zoomAt(vp, { x: vp.width / 2, y: vp.height / 2 }, factor));
    },
    [commit],
  );

  const fit = useCallback(() => {
    const size = sizeRef.current;
    if (size) commit(makeFitRef.current(size.w, size.h));
  }, [commit]);

  // Measure the container; first measurement builds the fit viewport, later ones only resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const apply = (w: number, h: number) => {
      if (!(w > 0) || !(h > 0)) return;
      const prev = sizeRef.current;
      if (prev && prev.w === w && prev.h === h) return;
      sizeRef.current = { w, h };
      const cur = viewportRef.current;
      commit(cur ? { ...cur, width: w, height: h } : makeFitRef.current(w, h));
    };
    const measure = () => {
      const r = el.getBoundingClientRect();
      apply(r.width, r.height);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && cr.width > 0 && cr.height > 0) apply(cr.width, cr.height);
      else measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, commit]);

  // Space held = pan mode.
  useEffect(() => {
    const setPanning = (v: boolean) => {
      if (panningRef.current === v) return;
      panningRef.current = v;
      setPanningState(v);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return;
      if (!isActivatable(e.target)) e.preventDefault();
      setPanning(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanning(false);
    };
    const onBlur = () => setPanning(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Wheel zoom + pointer pan/pinch on the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const local = (e: { clientX: number; clientY: number }): ScreenPoint => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const ignored = (e: Event) => e.target instanceof Element && !!e.target.closest('[data-no-zoompan]');

    const onWheel = (e: WheelEvent) => {
      const vp = viewportRef.current;
      if (!vp || ignored(e)) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT_PX : e.deltaY;
      commit(zoomAt(vp, local(e), Math.exp(-dy * WHEEL_SENSITIVITY)));
    };

    const pointers = new Map<number, ScreenPoint>();
    let dragId: number | null = null; // single pointer dragging while Space is held
    let last: { mid: ScreenPoint; dist: number } | null = null; // two-pointer gesture

    const gesture = () => {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return null;
      return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        dist: Math.hypot(a.x - b.x, a.y - b.y),
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (ignored(e)) return;
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 2) {
        dragId = null;
        last = gesture();
      } else if (pointers.size === 1 && panningRef.current) {
        dragId = e.pointerId;
        try {
          el.setPointerCapture?.(e.pointerId);
        } catch {
          // capture is best-effort
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      pointers.set(e.pointerId, cur);
      const vp = viewportRef.current;
      if (!vp) return;
      if (pointers.size === 2) {
        const g = gesture();
        if (g && last) {
          let next = panBy(vp, g.mid.x - last.mid.x, g.mid.y - last.mid.y);
          if (last.dist > 0 && g.dist > 0) next = zoomAt(next, g.mid, g.dist / last.dist);
          commit(next);
        }
        last = g;
      } else if (dragId === e.pointerId) {
        commit(panBy(vp, cur.x - prev.x, cur.y - prev.y));
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (dragId === e.pointerId) dragId = null;
      last = pointers.size === 2 ? gesture() : null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [containerRef, commit]);

  return { viewport, setViewport: commit, fit, zoomBy, panning };
}
