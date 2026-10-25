import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { playsRepo } from '@/db/repos/plays';
import { createPlay } from '@/domain/formations';
import { useEditorStore } from '@/store/editorStore';
import { MetaPanel } from '../MetaPanel';

let n = 0;
const idGen = () => `m${++n}`;

function load(side: 'offense' | 'defense', tags: string[] = []): void {
  const play = createPlay({ side, format: '5v5', formationId: null, now: 1, idGen });
  useEditorStore.getState().load({ ...play, tags });
}

const tags = () => useEditorStore.getState().play!.tags;

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  useEditorStore.getState().load(null);
});

describe('MetaPanel (FR-ED-05)', () => {
  it('suggests convention tags (cov:cover-2 on defense) and existing DB tags by prefix', async () => {
    const stored = createPlay({ side: 'offense', format: '5v5', formationId: null, now: 1, idGen });
    await playsRepo.put({ ...stored, tags: ['cov:custom', 'my-tag'] });
    load('defense');
    const user = userEvent.setup();
    render(<MetaPanel />);

    await user.click(screen.getByTestId('play-tags-input'));
    await user.type(screen.getByTestId('play-tags-input'), 'cov:c');
    const list = screen.getByRole('listbox');
    await waitFor(() => expect(within(list).getByText('cov:custom')).toBeInTheDocument());
    const names = within(list)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toContain('cov:cover-2');
    expect(names).not.toContain('blitz');
    expect(names).not.toContain('my-tag');

    // case-insensitive prefix
    await user.clear(screen.getByTestId('play-tags-input'));
    await user.type(screen.getByTestId('play-tags-input'), 'MY');
    await waitFor(() =>
      expect(
        within(screen.getByRole('listbox'))
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['my-tag']),
    );
  });

  it('offers offense convention tags on offense plays', async () => {
    load('offense');
    const user = userEvent.setup();
    render(<MetaPanel />);
    await user.type(screen.getByTestId('play-tags-input'), 'concept:');
    const names = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toEqual(['concept:flood', 'concept:mesh', 'concept:smash']);
  });

  it('Enter adds a trimmed lower-case chip, ignores duplicates; clicking an option adds it; remove works', async () => {
    load('defense');
    const user = userEvent.setup();
    render(<MetaPanel />);
    const input = screen.getByTestId('play-tags-input');

    await user.type(input, '  Blitz {Enter}');
    expect(tags()).toEqual(['blitz']);
    expect(screen.getByTestId('tag-blitz')).toBeInTheDocument();
    expect(input).toHaveValue('');

    await user.type(input, 'BLITZ{Enter}');
    expect(tags()).toEqual(['blitz']);

    await user.type(input, 'cov:cover-3');
    await user.click(screen.getByRole('option', { name: 'cov:cover-3' }));
    expect(tags()).toEqual(['blitz', 'cov:cover-3']);
    expect(screen.getByTestId('tag-cov:cover-3')).toBeInTheDocument();

    await user.click(screen.getByTestId('tag-remove-blitz'));
    expect(tags()).toEqual(['cov:cover-3']);
    expect(screen.queryByTestId('tag-blitz')).toBeNull();

    // existing tags are no longer suggested
    await user.type(input, 'cov:cover-3');
    expect(screen.queryByRole('option', { name: 'cov:cover-3' })).toBeNull();
  });

  it('edits formation and notes in the store', async () => {
    load('offense');
    const user = userEvent.setup();
    render(<MetaPanel />);
    await user.type(screen.getByTestId('play-formation'), 'Trips');
    await user.type(screen.getByTestId('play-notes'), 'Chạy nhanh');
    const play = useEditorStore.getState().play!;
    expect(play.formation).toBe('Trips');
    expect(play.notes).toBe('Chạy nhanh');
    expect(screen.getByTestId('play-notes')).toHaveValue('Chạy nhanh');
  });
});
