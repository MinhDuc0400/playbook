import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { playsRepo } from '@/db/repos/plays';
import { createPlay } from '@/domain/formations';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import EditorPage from '../EditorPage';

let n = 0;
const idGen = () => `p${++n}`;

function Where(): JSX.Element {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/" element={<p data-testid="home">home</p>} />
        <Route path="/play/new" element={<EditorPage />} />
        <Route path="/play/:id" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function seed(overrides: Partial<Play> = {}): Promise<Play> {
  const base = createPlay({ side: 'offense', format: '5v5', formationId: '5v5-off-2x1', now: 1000, idGen });
  const play = { ...base, name: 'Smash', ...overrides };
  await playsRepo.put(play);
  return play;
}

const storeX = (label: string) =>
  useEditorStore.getState().play?.players.find((p) => p.label === label)?.start.x;

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  useEditorStore.getState().load(null);
  useEditorStore.setState({ tool: 'select', selection: [] });
});

describe('EditorPage: creation (FR-ED-01)', () => {
  it('/play/new shows the dialog; Cancel returns to the playbook', async () => {
    const user = userEvent.setup();
    renderAt('/play/new');
    expect(await screen.findByTestId('new-play-create')).toBeInTheDocument();
    // default format comes from settings
    expect(screen.getByTestId('new-play-format')).toHaveValue('5v5');
    await user.click(screen.getByTestId('new-play-cancel'));
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('creating a defense Cover 2 play opens it in the editor', async () => {
    const user = userEvent.setup();
    renderAt('/play/new');
    await user.click(await screen.findByTestId('new-play-side-defense'));
    await user.selectOptions(screen.getByTestId('new-play-formation'), 'Cover 2');
    await user.click(screen.getByTestId('new-play-create'));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/play\/.+/));
    const id = screen.getByTestId('where').textContent!.replace('/play/', '');
    expect((await playsRepo.get(id))?.players).toHaveLength(5);
    expect(await screen.findByTestId('editor-page')).toBeInTheDocument();
    expect(screen.getByTestId('play-side')).toHaveTextContent('Defense');
    expect(screen.queryByTestId('btn-preview')).toBeNull();
  });
});

describe('EditorPage: loading', () => {
  it('shows editor-not-found for an unknown id', async () => {
    renderAt('/play/nope');
    expect(await screen.findByTestId('editor-not-found')).toBeInTheDocument();
    expect(screen.getByText(t.editor.backToPlaybook)).toHaveAttribute('href', '/');
  });

  it('loads a stored play into the store', async () => {
    const play = await seed();
    renderAt(`/play/${play.id}`);
    expect(await screen.findByTestId('editor-page')).toBeInTheDocument();
    expect(useEditorStore.getState().play).toEqual(play);
    expect(screen.getByTestId('play-name')).toHaveValue('Smash');
    expect(screen.getByTestId('play-side')).toHaveTextContent('Offense');
    expect(screen.getByTestId('btn-preview')).toBeInTheDocument();
    expect(screen.getByTestId('warnings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('btn-undo')).toBeDisabled();
    expect(screen.getByTestId('btn-redo')).toBeDisabled();
    // opening a play does not re-save it
    await new Promise((r) => setTimeout(r, 1000));
    expect((await playsRepo.get(play.id))?.updatedAt).toBe(1000);
  });

  it('a live-query update caused by auto-save does not reset the undo history', async () => {
    const play = await seed();
    const user = userEvent.setup();
    renderAt(`/play/${play.id}`);
    await screen.findByTestId('editor-page');
    await user.click(screen.getByTestId('btn-flip'));
    expect(screen.getByTestId('btn-undo')).toBeEnabled();

    await waitFor(async () => expect((await playsRepo.get(play.id))?.updatedAt).toBeGreaterThan(1000), {
      timeout: 4000,
    });
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Đã lưu'));
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(useEditorStore.getState().canUndo()).toBe(true);
    expect(screen.getByTestId('btn-undo')).toBeEnabled();
    expect(storeX('X')).toBe(12);
  });
});

describe('EditorPage: auto-save (FR-DAT-04)', () => {
  it('renaming shows "Chưa lưu" then saves after the debounce and shows "Đã lưu"', async () => {
    const play = await seed();
    const user = userEvent.setup();
    renderAt(`/play/${play.id}`);
    await screen.findByTestId('editor-page');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Đã lưu');

    const input = screen.getByTestId('play-name');
    await user.clear(input);
    await user.type(input, 'Mesh');
    expect(screen.getByTestId('save-status')).toHaveTextContent('Chưa lưu');
    expect((await playsRepo.get(play.id))?.name).toBe('Smash');

    await waitFor(async () => expect((await playsRepo.get(play.id))?.name).toBe('Mesh'), { timeout: 4000 });
    expect((await playsRepo.get(play.id))!.updatedAt).toBeGreaterThan(1000);
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Đã lưu'));
  });
});

describe('EditorPage: actions', () => {
  it('Duplicate saves pending edits, creates a copy and navigates to it', async () => {
    const play = await seed();
    const user = userEvent.setup();
    renderAt(`/play/${play.id}`);
    await screen.findByTestId('editor-page');
    await user.type(screen.getByTestId('play-name'), '2');
    await user.click(screen.getByTestId('btn-duplicate'));

    await waitFor(() => expect(screen.getByTestId('where').textContent).not.toBe(`/play/${play.id}`));
    const copyId = screen.getByTestId('where').textContent!.replace('/play/', '');
    const all = await playsRepo.list();
    expect(all).toHaveLength(2);
    expect(await playsRepo.get(play.id)).toMatchObject({ name: 'Smash2' });
    expect(await playsRepo.get(copyId)).toMatchObject({ name: 'Smash2 (bản sao)' });
    await waitFor(() => expect(screen.getByTestId('play-name')).toHaveValue('Smash2 (bản sao)'));
  });

  it('Flip button flips as one undo step; undo / redo buttons follow the history', async () => {
    const play = await seed();
    const user = userEvent.setup();
    renderAt(`/play/${play.id}`);
    await screen.findByTestId('editor-page');
    expect(storeX('X')).toBe(-12);

    await user.click(screen.getByTestId('btn-flip'));
    expect(storeX('X')).toBe(12);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);
    expect(screen.getByTestId('btn-undo')).toBeEnabled();
    expect(screen.getByTestId('btn-redo')).toBeDisabled();

    await user.click(screen.getByTestId('btn-undo'));
    expect(storeX('X')).toBe(-12);
    expect(screen.getByTestId('btn-undo')).toBeDisabled();
    expect(screen.getByTestId('btn-redo')).toBeEnabled();

    await user.click(screen.getByTestId('btn-redo'));
    expect(storeX('X')).toBe(12);
  });

  it('F flips, Ctrl+Z undoes, but typing in the name field does not trigger shortcuts', async () => {
    const play = await seed();
    const user = userEvent.setup();
    renderAt(`/play/${play.id}`);
    await screen.findByTestId('editor-page');

    await user.click(screen.getByTestId('play-name'));
    await user.keyboard('f');
    expect(storeX('X')).toBe(-12);
    expect(useEditorStore.getState().play?.name).toBe('Smashf');

    (document.activeElement as HTMLElement).blur();
    await user.keyboard('f');
    expect(storeX('X')).toBe(12);
    await user.keyboard('{Control>}z{/Control}');
    expect(storeX('X')).toBe(-12);
  });

  it('the preview button toggles previewing on offense', async () => {
    const play = await seed();
    const user = userEvent.setup();
    renderAt(`/play/${play.id}`);
    await screen.findByTestId('editor-page');
    await user.click(screen.getByTestId('btn-preview'));
    expect(useEditorStore.getState().previewing).toBe(true);
    await user.click(screen.getByTestId('btn-preview'));
    expect(useEditorStore.getState().previewing).toBe(false);
  });
});
