import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/domain/types';
import { PlaySchema } from '@/lib/io/schemas';
import { useEditorStore } from '@/store/editorStore';
import { PlayerTray } from '../PlayerTray';
import { emptyPlay, placeRole, remaining } from '../trayOps';

let n = 0;
const idGen = () => `s${++n}`;

function Harness({ onArm }: { onArm?: (r: Role | null) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  return (
    <PlayerTray
      maxPlayers={5}
      pendingRole={role}
      onPendingRole={(r) => {
        setRole(r);
        onArm?.(r);
      }}
    />
  );
}

describe('T-FS-03 trayOps', () => {
  it('emptyPlay passes PlaySchema with no players', () => {
    for (const side of ['offense', 'defense'] as const) {
      const p = emptyPlay(side, '5v5', 1);
      expect(PlaySchema.safeParse(p).success).toBe(true);
      expect(p.players).toHaveLength(0);
      expect(p.side).toBe(side);
    }
  });

  it('placeRole adds a player with role, label and position', () => {
    const p = placeRole('WR', { x: 3, y: -1 }, 5, idGen)(emptyPlay('offense', '5v5', 1));
    expect(p.players).toHaveLength(1);
    expect(p.players[0]).toMatchObject({ role: 'WR', start: { x: 3, y: -1 } });
    expect(p.players[0]?.label).toBeTruthy();
  });

  it('remaining counts shrink and cap at maxPlayers', () => {
    let p = emptyPlay('offense', '5v5', 1);
    expect(remaining(p, 'offense', 5).WR).toBe(5);
    expect(remaining(p, 'offense', 5).QB).toBe(1);
    p = placeRole('QB', { x: 0, y: -3 }, 5, idGen)(p);
    expect(remaining(p, 'offense', 5).QB).toBe(0);
    expect(remaining(p, 'offense', 5).WR).toBe(4);
    for (let i = 0; i < 6; i++) p = placeRole('WR', { x: i, y: 0 }, 5, idGen)(p);
    expect(p.players).toHaveLength(5);
    expect(Object.values(remaining(p, 'offense', 5)).every((v) => v === 0)).toBe(true);
    expect(placeRole('QB', { x: 0, y: 0 }, 5, idGen)(p)).toBe(p);
  });
});

describe('T-FS-03 PlayerTray', () => {
  beforeEach(() => {
    useEditorStore.getState().load(emptyPlay('defense', '5v5', 1));
  });

  it('shows chips for the active side with counts; click arms and disarms', () => {
    render(<Harness />);
    expect(screen.queryByTestId('tray-chip-QB')).toBeNull();
    expect(screen.getByTestId('tray-count-CB').textContent).toBe('5');
    const chip = screen.getByTestId('tray-chip-CB');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('dragstart sets the role data type', () => {
    render(<Harness />);
    const setData = (() => {
      const calls: [string, string][] = [];
      return Object.assign((k: string, v: string) => void calls.push([k, v]), { calls });
    })();
    fireEvent.dragStart(screen.getByTestId('tray-chip-LB'), { dataTransfer: { setData } });
    expect(setData.calls).toEqual([['application/x-flagbook-role', 'LB']]);
  });

  it('chip is disabled when exhausted', () => {
    const { apply } = useEditorStore.getState();
    for (let i = 0; i < 5; i++) apply('add', placeRole('S', { x: i, y: 5 }, 5, idGen));
    render(<Harness />);
    expect((screen.getByTestId('tray-chip-CB') as HTMLButtonElement).disabled).toBe(true);
  });

  it('remove button removes the selected player', () => {
    const { apply, select } = useEditorStore.getState();
    apply(
      'add',
      placeRole('CB', { x: 0, y: 5 }, 5, () => 'cb1'),
    );
    render(<Harness />);
    expect((screen.getByTestId('tray-remove') as HTMLButtonElement).disabled).toBe(true);
    act(() => select(['cb1']));
    fireEvent.click(screen.getByTestId('tray-remove'));
    expect(useEditorStore.getState().play?.players).toHaveLength(0);
  });
});
