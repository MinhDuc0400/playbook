import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playsRepo } from '@/db/repos/plays';
import { t } from '@/i18n/vi';
import { NewPlayDialog } from '../NewPlayDialog';

function Where(): JSX.Element {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderDialog(onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/play/new']}>
      <Where />
      <Routes>
        <Route path="/play/new" element={<NewPlayDialog open defaultFormat="5v5" onClose={onClose} />} />
        <Route path="/play/:id" element={<p>editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return onClose;
}

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
});

describe('NewPlayDialog (FR-ED-01)', () => {
  it('defense + 5v5 + Cover 2 stores a 5-player play and navigates to /play/<id>', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId('new-play-side-defense'));
    await user.selectOptions(screen.getByTestId('new-play-format'), '5v5');
    await user.selectOptions(screen.getByTestId('new-play-formation'), 'Cover 2');
    await user.click(screen.getByTestId('new-play-create'));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/play\/.+/));
    const id = screen.getByTestId('where').textContent!.replace('/play/', '');
    const stored = await playsRepo.get(id);
    expect(stored?.side).toBe('defense');
    expect(stored?.format).toBe('5v5');
    expect(stored?.formation).toBe('Cover 2');
    expect(stored?.players).toHaveLength(5);
    expect(await playsRepo.count()).toBe(1);
  });

  it('blank start creates a play without players', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId('new-play-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/play\/.+/));
    const [stored] = await playsRepo.list();
    expect(stored?.side).toBe('offense');
    expect(stored?.players).toEqual([]);
    expect(stored?.formation).toBe('');
  });

  it('formation options follow side and format, and reset to blank on change', async () => {
    const user = userEvent.setup();
    renderDialog();
    const formation = screen.getByTestId('new-play-formation') as HTMLSelectElement;
    const names = () =>
      within(formation)
        .getAllByRole('option')
        .map((o) => o.textContent);
    expect(names()).toEqual([t.editor.newPlay.blank, '2x1', 'Trips', 'Bunch', 'Stack', 'Spread RB']);

    await user.selectOptions(formation, 'Trips');
    expect(formation.value).toBe('5v5-off-trips');
    await user.selectOptions(screen.getByTestId('new-play-format'), '7v7');
    expect(formation.value).toBe('');
    expect(names()).toEqual([t.editor.newPlay.blank, '3x2', 'Trips 7v7']);

    await user.click(screen.getByTestId('new-play-side-defense'));
    expect(names()).toEqual([t.editor.newPlay.blank, 'Cover 2 7v7', 'Cover 3 7v7']);
  });

  it('defaults the format select to defaultFormat and Cancel calls onClose without saving', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <NewPlayDialog open defaultFormat="7v7" onClose={onClose} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('new-play-format')).toHaveValue('7v7');
    await user.click(screen.getByTestId('new-play-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await playsRepo.count()).toBe(0);
  });
});
