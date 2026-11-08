import { act, render, screen } from '@testing-library/react';
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

  it('Ctrl+A / Cmd+A selects every player of the play and switches to the Select tool (D-45)', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().load(makePlay('offense'));
    useEditorStore.setState({ tool: 'route' });
    render(<Harness />);
    await user.keyboard('{Control>}a{/Control}');
    const ids = useEditorStore.getState().play!.players.map((p) => p.id);
    expect(useEditorStore.getState().selection).toEqual(ids);
    expect(useEditorStore.getState().tool).toBe('select');
    useEditorStore.getState().select([]);
    await user.keyboard('{Meta>}a{/Meta}');
    expect(useEditorStore.getState().selection).toEqual(ids);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('Ctrl+C / Ctrl+V copies the selected players and pastes them 1 yd over, selected, in one undo step', async () => {
    const user = userEvent.setup();
    const play = makePlay('offense');
    useEditorStore.getState().load({ ...play, players: play.players.slice(0, 3) });
    const [a, b] = useEditorStore.getState().play!.players;
    useEditorStore.getState().select([a!.id, b!.id]);
    render(<Harness max={5} />);

    await user.keyboard('{Control>}c{/Control}');
    expect(useEditorStore.getState().play!.players).toHaveLength(3); // copy alone changes nothing
    await user.keyboard('{Control>}v{/Control}');
    const players = useEditorStore.getState().play!.players;
    expect(players).toHaveLength(5);
    const [pa, pb] = players.slice(3);
    expect(pa!.start).toEqual({ x: a!.start.x + 1, y: a!.start.y });
    expect(pb!.start).toEqual({ x: b!.start.x + 1, y: b!.start.y });
    expect(pa!.id).not.toBe(a!.id);
    expect(useEditorStore.getState().selection).toEqual([pa!.id, pb!.id]);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);
  });

  it('a second paste lands 1 yd further; the player limit stops extra copies', async () => {
    const user = userEvent.setup();
    const play = makePlay('offense');
    useEditorStore.getState().load({ ...play, players: play.players.slice(0, 3) });
    const a = useEditorStore.getState().play!.players[0]!;
    useEditorStore.getState().select([a.id]);
    render(<Harness max={5} />);
    await user.keyboard(
      '{Control>}c{/Control}{Control>}v{/Control}{Control>}v{/Control}{Control>}v{/Control}',
    );
    const players = useEditorStore.getState().play!.players;
    expect(players).toHaveLength(5);
    expect(players[3]!.start.x).toBe(a.start.x + 1);
    expect(players[4]!.start.x).toBe(a.start.x + 2);
  });

  it('Ctrl+C with nothing selected keeps the old clipboard; paste needs the same side', async () => {
    const user = userEvent.setup();
    const off = makePlay('offense');
    useEditorStore.getState().load({ ...off, players: off.players.slice(0, 3) });
    useEditorStore.getState().select([useEditorStore.getState().play!.players[0]!.id]);
    render(<Harness max={5} />);
    await user.keyboard('{Control>}c{/Control}');
    useEditorStore.getState().select([]);
    await user.keyboard('{Control>}c{/Control}{Control>}v{/Control}');
    expect(useEditorStore.getState().play!.players).toHaveLength(4);
    act(() => useEditorStore.getState().load(makePlay('defense')));
    const n = useEditorStore.getState().play!.players.length;
    await user.keyboard('{Control>}v{/Control}');
    expect(useEditorStore.getState().play!.players).toHaveLength(n);
  });
});
