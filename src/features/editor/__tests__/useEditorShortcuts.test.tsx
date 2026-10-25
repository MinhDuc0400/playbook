import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPlay } from '@/domain/formations';
import type { Play } from '@/domain/types';
import { useEditorStore } from '@/store/editorStore';
import { useEditorShortcuts } from '../useEditorShortcuts';

let n = 0;
const idGen = () => `id${++n}`;

function makePlay(side: 'offense' | 'defense'): Play {
  return createPlay({
    side,
    format: '5v5',
    formationId: side === 'offense' ? '5v5-off-2x1' : '5v5-def-cover-2',
    now: 1,
    idGen,
  });
}

function Harness({ max = 5, dialog = false }: { max?: number; dialog?: boolean }): JSX.Element {
  useEditorShortcuts(max);
  return (
    <div>
      <input data-testid="field" />
      {dialog ? <div role="dialog" /> : null}
    </div>
  );
}

const x = (id: string) => useEditorStore.getState().play?.players.find((p) => p.label === id)?.start.x;

beforeEach(() => {
  useEditorStore.getState().load(null);
  useEditorStore.setState({ tool: 'select' });
});

describe('useEditorShortcuts (SRS §12.3)', () => {
  it('F flips the play as a single undo step; Ctrl+Z / Ctrl+Shift+Z undo and redo', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().load(makePlay('offense'));
    render(<Harness />);
    expect(x('X')).toBe(-12);

    await user.keyboard('f');
    expect(x('X')).toBe(12);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);

    await user.keyboard('{Control>}z{/Control}');
    expect(x('X')).toBe(-12);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(x('X')).toBe(12);
    await user.keyboard('{Control>}z{/Control}');
    expect(x('X')).toBe(-12);
    await user.keyboard('{Control>}y{/Control}');
    expect(x('X')).toBe(12);
    await user.keyboard('{Meta>}z{/Meta}');
    expect(x('X')).toBe(-12);
  });

  it('v / p / r switch tools on offense; r is ignored on defense', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().load(makePlay('offense'));
    render(<Harness />);
    await user.keyboard('p');
    expect(useEditorStore.getState().tool).toBe('place');
    await user.keyboard('r');
    expect(useEditorStore.getState().tool).toBe('route');
    await user.keyboard('v');
    expect(useEditorStore.getState().tool).toBe('select');

    useEditorStore.getState().load(makePlay('defense'));
    await user.keyboard('r');
    expect(useEditorStore.getState().tool).toBe('select');
    await user.keyboard('p');
    expect(useEditorStore.getState().tool).toBe('place');
  });

  it('ignores keys typed in an input or while a dialog is open', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().load(makePlay('offense'));
    const { rerender } = render(<Harness />);
    await user.click(screen.getByTestId('field'));
    await user.keyboard('fpr');
    expect(x('X')).toBe(-12);
    expect(useEditorStore.getState().tool).toBe('select');

    screen.getByTestId('field').blur();
    rerender(<Harness dialog />);
    await user.keyboard('f');
    expect(x('X')).toBe(-12);
  });

  it('Ctrl+D duplicates the selected players in one undo step, within the player limit', async () => {
    const user = userEvent.setup();
    const play = makePlay('offense');
    useEditorStore.getState().load({ ...play, players: play.players.slice(0, 4) });
    const [a, b] = useEditorStore.getState().play!.players;
    useEditorStore.getState().select([a!.id, b!.id]);
    render(<Harness max={5} />);

    await user.keyboard('{Control>}d{/Control}');
    // 4 players + 2 copies would be 6; the limit of 5 stops the second copy.
    expect(useEditorStore.getState().play!.players).toHaveLength(5);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);
    await user.keyboard('{Control>}z{/Control}');
    expect(useEditorStore.getState().play!.players).toHaveLength(4);
  });
});
