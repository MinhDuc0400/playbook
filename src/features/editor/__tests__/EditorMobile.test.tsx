/** Phone/tablet editor layout (D-25): matchMedia reports (min-width: 1024px) = false. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultViewport, toScreen } from '@/components/field/viewport';
import { playsRepo } from '@/db/repos/plays';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import { createPlay } from '@/domain/formations';
import type { Point } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import EditorPage from '../EditorPage';
import { EditorCanvas } from '../EditorCanvas';
import { getRoute } from '../ops';
import { Toolbar } from '../Toolbar';
import { offenseFixture } from './fixtures';

vi.mock('@/lib/export/png', () => ({ exportNodeToPng: vi.fn(async () => {}) }));

const store = () => useEditorStore.getState();

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // @ts-expect-error restore jsdom default (no matchMedia)
  delete window.matchMedia;
});

describe('EditorPage on a phone (D-25)', () => {
  it('renders the field before the panel tabs, with overflow menu and three tabs', async () => {
    for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
    const play = createPlay({
      side: 'offense',
      format: '5v5',
      formationId: '5v5-off-2x1',
      now: 1000,
      idGen: (() => {
        let n = 0;
        return () => `m${++n}`;
      })(),
    });
    await playsRepo.put(play);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/play/${play.id}`]}>
        <Routes>
          <Route path="/play/:id" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('editor-page');
    const fieldBox = screen.getByTestId('editor-field');
    const tabs = screen.getByTestId('panel-tabs');
    expect(tabs).toHaveAttribute('data-mode', 'tabs');
    expect(fieldBox.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('tab').map((x) => x.textContent)).toEqual([
      t.editor.panels.play,
      t.editor.panels.players,
      expect.stringContaining(t.editor.panels.warnings),
    ]);
    expect(screen.getByTestId('meta-panel')).toBeInTheDocument();
    await user.click(screen.getByTestId('panel-tabs-tab-players'));
    expect(screen.getByTestId('offense-panel')).toBeInTheDocument();

    expect(screen.queryByTestId('btn-duplicate')).toBeNull();
    await user.click(screen.getByTestId('topbar-more'));
    expect(screen.getByTestId('btn-duplicate')).toBeInTheDocument();
    expect(screen.getByTestId('btn-export-png')).toBeInTheDocument();
    for (const id of ['btn-flip', 'btn-preview', 'btn-undo', 'btn-redo']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId('btn-tool-done')).toBeInTheDocument();
  });
});

describe('touch action buttons (D-25)', () => {
  const field = createDefaultFields()['5v5'];
  const vp = defaultViewport(800, 600, field, DEFAULT_BALL_SPOT);
  const px = (p: Point) => {
    const s = toScreen(p, vp);
    return { clientX: s.x, clientY: s.y };
  };

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
    store().load(offenseFixture());
    store().setTool('select');
  });

  const setup = () => {
    render(
      <>
        <Toolbar />
        <EditorCanvas field={field} ballSpot={DEFAULT_BALL_SPOT} snap />
      </>,
    );
    return screen.getByTestId('field-svg');
  };

  it('"Xong" finishes a route drawn with pointer events; "Hủy" cancels a draft', () => {
    const svg = setup();
    act(() => store().setTool('route'));
    fireEvent.pointerDown(screen.getByTestId('token-Z'), { pointerId: 1, ...px({ x: 8, y: 0 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    for (const p of [
      { x: 8, y: 6 },
      { x: 12, y: 10 },
    ]) {
      fireEvent.pointerDown(svg, { pointerId: 1, ...px(p) });
      fireEvent.pointerUp(svg, { pointerId: 1, ...px(p) });
    }
    fireEvent.click(screen.getByTestId('btn-tool-done'));
    expect(screen.getByTestId('route-Z')).toBeInTheDocument();
    expect(getRoute(store().play!, 'z')?.path).toHaveLength(2);

    // second draft is cancelled
    act(() => store().setTool('route'));
    fireEvent.pointerDown(screen.getByTestId('token-X'), { pointerId: 1, ...px({ x: -8, y: 0 }) });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.pointerDown(svg, { pointerId: 1, ...px({ x: -8, y: 6 }) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...px({ x: -8, y: 6 }) });
    expect(store().draft).not.toBeNull();
    fireEvent.click(screen.getByTestId('btn-tool-cancel'));
    expect(store().draft).toBeNull();
  });

  it('"Xóa" deletes the selected player', () => {
    setup();
    act(() => store().select(['z']));
    fireEvent.click(screen.getByTestId('btn-delete-selection'));
    expect(store().play?.players.find((p) => p.id === 'z')).toBeUndefined();
  });
});
