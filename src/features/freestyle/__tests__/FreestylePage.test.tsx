import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { setFeatureOverride } from '@/config/features';
import { makeSettings } from '@/db/__tests__/fixtures';
import { settingsRepo } from '@/db/repos';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { Point } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import FreestylePage from '../FreestylePage';

vi.mock('@/db/errors', () => ({ onDbError: vi.fn(() => () => undefined) }));
vi.mock('@/app/BackupBanner', () => ({ BackupBanner: () => null }));

const W = 800;
const H = 600;
const vp = defaultViewport(W, H, createDefaultFields()['5v5'], DEFAULT_BALL_SPOT);
const px = (p: Point) => {
  const s = toScreen(p, vp);
  return { clientX: s.x, clientY: s.y };
};
const store = () => useEditorStore.getState();
const counts = () => ({
  active: store().play?.players.length ?? 0,
  other: store().companion?.players.length ?? 0,
});

async function mount() {
  render(
    <MemoryRouter initialEntries={['/freestyle']}>
      <Routes>
        <Route path="/freestyle" element={<FreestylePage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('freestyle-page');
}

function place(chip: string, at: Point) {
  fireEvent.click(screen.getByTestId(`tray-chip-${chip}`));
  fireEvent.pointerDown(screen.getByTestId('field-svg'), { pointerId: 1, ...px(at) });
}

beforeEach(async () => {
  localStorage.clear();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: W,
    bottom: H,
    width: W,
    height: H,
    toJSON: () => ({}),
  });
  await settingsRepo.put(makeSettings());
  store().load(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('T-FS-04 Freestyle page', () => {
  it('starts as a blank board on offense with no players', async () => {
    await mount();
    expect(counts()).toEqual({ active: 0, other: 0 });
    expect(store().play?.side).toBe('offense');
    expect(screen.getByTestId('fs-side-offense')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('fs-side-defense')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('fs-run')).toBeDisabled();
  });

  it('placing via the tray adds players to the active side only and selects the new one', async () => {
    await mount();
    place('WR', { x: 3, y: -1 });
    expect(counts()).toEqual({ active: 1, other: 0 });
    expect(store().selection).toEqual([store().play!.players[0]!.id]);
    place('QB', { x: 0, y: -5 });
    expect(counts()).toEqual({ active: 2, other: 0 });
  });

  it('switching side swaps the active side and keeps the other side players', async () => {
    await mount();
    place('WR', { x: 3, y: -1 });
    fireEvent.click(screen.getByTestId('fs-side-defense'));
    expect(store().play?.side).toBe('defense');
    expect(counts()).toEqual({ active: 0, other: 1 });
    expect(screen.getByTestId('fs-side-defense')).toHaveAttribute('aria-pressed', 'true');
    place('CB', { x: -4, y: 5 });
    expect(counts()).toEqual({ active: 1, other: 1 });
    fireEvent.click(screen.getByTestId('fs-side-offense'));
    expect(counts()).toEqual({ active: 1, other: 1 });
    expect(store().play?.side).toBe('offense');
  });

  it('Tab on the board toggles the side; Tab on a button does not', async () => {
    await mount();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(store().play?.side).toBe('defense');
    fireEvent.keyDown(screen.getByTestId('fs-undo'), { key: 'Tab' });
    expect(store().play?.side).toBe('defense');
  });

  it('Mới asks first when players exist, then clears both sides', async () => {
    await mount();
    fireEvent.click(screen.getByTestId('fs-clear')); // nothing to lose: no prompt
    expect(screen.getByTestId('fs-clear')).toHaveTextContent(t.freestyle.clear);
    place('WR', { x: 3, y: -1 });
    fireEvent.click(screen.getByTestId('fs-side-defense'));
    place('CB', { x: -4, y: 5 });
    fireEvent.click(screen.getByTestId('fs-clear'));
    expect(screen.getByTestId('fs-clear')).toHaveTextContent(t.freestyle.clearConfirm);
    expect(counts()).toEqual({ active: 1, other: 1 });
    fireEvent.click(screen.getByTestId('fs-clear'));
    expect(counts()).toEqual({ active: 0, other: 0 });
    expect(screen.getByTestId('fs-clear')).toHaveTextContent(t.freestyle.clear);
  });

  it('undo works across sides and the button state follows history', async () => {
    await mount();
    expect(screen.getByTestId('fs-undo')).toBeDisabled();
    place('WR', { x: 3, y: -1 });
    expect(screen.getByTestId('fs-undo')).toBeEnabled();
    fireEvent.click(screen.getByTestId('fs-side-defense'));
    place('CB', { x: -4, y: 5 });
    fireEvent.click(screen.getByTestId('fs-undo'));
    expect(counts()).toEqual({ active: 0, other: 1 });
    expect(screen.getByTestId('fs-redo')).toBeEnabled();
    act(() => store().undo());
    await waitFor(() => expect(counts().other + counts().active).toBe(0));
  });
});

describe('T-FS-04 Freestyle nav', () => {
  it.each([true, false])('nav-freestyle is present with advanced=%s', async (advanced) => {
    vi.doMock('@/app/BackupBanner', () => ({ BackupBanner: () => null }));
    const { Layout } = await import('@/app/Layout');
    setFeatureOverride(advanced);
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<p>home</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('nav-freestyle')).toHaveAttribute('href', '/freestyle');
    setFeatureOverride(null);
  });
});
