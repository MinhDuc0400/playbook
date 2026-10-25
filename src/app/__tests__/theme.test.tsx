import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/domain/types';

vi.mock('@/db/hooks', () => ({ useSettings: vi.fn() }));

import { useSettings } from '@/db/hooks';
import { resolveTheme, useApplyTheme } from '../theme';

const settingsMock = vi.mocked(useSettings);

function withTheme(theme: 'light' | 'dark' | 'system'): Settings {
  return { ui: { theme, snap: true, showGrid: true } } as Settings;
}

afterEach(cleanup);

describe('NFR-UX-02 theme', () => {
  it('resolveTheme matrix', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  describe('useApplyTheme', () => {
    let systemDark = false;
    let listeners: Array<() => void> = [];

    beforeEach(() => {
      systemDark = false;
      listeners = [];
      document.documentElement.classList.remove('dark');
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation(() => ({
          get matches() {
            return systemDark;
          },
          addEventListener: (_: string, cb: () => void) => listeners.push(cb),
          removeEventListener: (_: string, cb: () => void) => {
            listeners = listeners.filter((l) => l !== cb);
          },
        })),
      );
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("'dark' adds the class even when the system is light", () => {
      settingsMock.mockReturnValue(withTheme('dark'));
      renderHook(() => useApplyTheme());
      expect(document.documentElement).toHaveClass('dark');
    });

    it("'light' removes the class even when the system is dark", () => {
      systemDark = true;
      document.documentElement.classList.add('dark');
      settingsMock.mockReturnValue(withTheme('light'));
      renderHook(() => useApplyTheme());
      expect(document.documentElement).not.toHaveClass('dark');
    });

    it("'system' follows the OS, including live changes", () => {
      systemDark = true;
      settingsMock.mockReturnValue(withTheme('system'));
      renderHook(() => useApplyTheme());
      expect(document.documentElement).toHaveClass('dark');
      act(() => {
        systemDark = false;
        listeners.forEach((l) => l());
      });
      expect(document.documentElement).not.toHaveClass('dark');
    });

    it('defaults to system while settings are loading', () => {
      systemDark = true;
      settingsMock.mockReturnValue(undefined);
      renderHook(() => useApplyTheme());
      expect(document.documentElement).toHaveClass('dark');
    });

    it('stops listening to the OS when the preference is explicit', () => {
      settingsMock.mockReturnValue(withTheme('light'));
      renderHook(() => useApplyTheme());
      expect(listeners).toHaveLength(0);
    });
  });
});
