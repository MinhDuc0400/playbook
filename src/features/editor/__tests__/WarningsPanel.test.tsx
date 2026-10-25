import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import { createPlay } from '@/domain/formations';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { WarningsPanel } from '../WarningsPanel';

let n = 0;
const idGen = () => `w${++n}`;
const field = createDefaultSettings().fields['5v5'];

function mk(side: 'offense' | 'defense', formationId: string): Play {
  return createPlay({ side, format: '5v5', formationId, now: 1, idGen });
}

beforeEach(() => {
  useEditorStore.getState().load(null);
});

describe('WarningsPanel (FR-ED-07)', () => {
  it('shows the empty message for a clean play', () => {
    useEditorStore.getState().load(mk('offense', '5v5-off-2x1'));
    render(<WarningsPanel field={field} />);
    expect(screen.getByTestId('warnings-panel')).toHaveTextContent(t.editor.warnings.none);
  });

  it('warns about too many players', () => {
    const play = mk('offense', '5v5-off-2x1');
    const extra = { ...play.players[2]!, id: 'extra', label: 'W' };
    useEditorStore.getState().load({ ...play, players: [...play.players, extra] });
    render(<WarningsPanel field={field} />);
    expect(screen.getByTestId('warning-too-many-players')).toHaveTextContent('6/5');
    expect(screen.queryByText(t.editor.warnings.none)).toBeNull();
  });

  it('warns about too few players', () => {
    useEditorStore.getState().load(mk('offense', '5v5-off-2x1'));
    useEditorStore.getState().apply('drop', (p) => ({ ...p, players: p.players.slice(0, 3) }));
    render(<WarningsPanel field={field} />);
    expect(screen.getByTestId('warning-too-few-players')).toHaveTextContent('3/5');
  });

  it('warns about a rusher inside the rush line and selects the slot on click', async () => {
    const user = userEvent.setup();
    const play = mk('defense', '5v5-def-cover-2');
    const rusher = play.players.find((s) => s.role === 'R')!;
    useEditorStore.getState().load({
      ...play,
      players: play.players.map((s) => (s.id === rusher.id ? { ...s, start: { x: 0, y: 5 } } : s)),
    });
    render(<WarningsPanel field={field} />);
    const warning = screen.getByTestId('warning-rusher-inside-rush-line');
    expect(warning).toHaveTextContent(rusher.label);
    expect(useEditorStore.getState().selection).toEqual([]);
    await user.click(warning);
    expect(useEditorStore.getState().selection).toEqual([rusher.id]);
  });

  it('updates when the play changes (wrong side of the LOS)', () => {
    useEditorStore.getState().load(mk('offense', '5v5-off-2x1'));
    render(<WarningsPanel field={field} />);
    expect(screen.queryByTestId('warning-wrong-side-of-los')).toBeNull();
    const slot = useEditorStore.getState().play!.players[2]!;
    act(() => {
      useEditorStore.getState().apply('move', (p) => ({
        ...p,
        players: p.players.map((s) => (s.id === slot.id ? { ...s, start: { x: 3, y: 4 } } : s)),
      }));
    });
    expect(screen.getByTestId('warning-wrong-side-of-los')).toHaveTextContent(slot.label);
  });
});
