import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setFeatureOverride } from '@/config/features';

// Existing tests cover every feature: run them in Advanced mode. Simple-mode tests call
// setFeatureOverride(false) themselves (D-26).
beforeEach(() => setFeatureOverride(true));

// Vitest globals are off, so Testing Library cannot auto-register cleanup.
afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});

// jsdom lacks PointerEvent; a MouseEvent subclass carries coordinates + pointer fields.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent = PointerEventShim;
  (globalThis as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent = PointerEventShim;
}
