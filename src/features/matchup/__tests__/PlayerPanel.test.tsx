import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSettings } from '@/domain/defaults';
import { DEFAULT_PRESETS } from '@/domain/presets';
import type { DbSnapshot, Matchup } from '@/domain/types';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { useMatchupStore } from '@/store/matchupStore';
import { createMatchup, type BuiltSim } from '../buildSimInput';
import { PlayerPanel } from '../PlayerPanel';

const snapshot: DbSnapshot = { settings: createDefaultSettings(), lineups: {}, athletes: {} };
const input = makeInput(floodPlay(), cover3Play());
const built: BuiltSim = { input, offense: input.offense, defense: input.defense, defenseFlipped: false };

function matchup(overrides: Matchup['overrides'] = []): Matchup {
  return {
    ...createMatchup({ offensePlayId: 'o', defensePlayId: 'd', now: 0, idGen: () => 'm' }),
    overrides,
  };
}

beforeEach(() => useMatchupStore.getState().reset());
afterEach(() => cleanup());

function select(label = 'Z'): void {
  act(() => useMatchupStore.getState().select({ side: 'offense', slotId: 'f-z', label }));
}

describe('PlayerPanel', () => {
  it('shows a hint when nothing is selected', () => {
    render(<PlayerPanel matchup={matchup()} built={built} snapshot={snapshot} onChange={vi.fn()} />);
    expect(screen.getByTestId('player-panel-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('level-weak')).toBeNull();
  });

  it('FR-ATH-01 level buttons call onChange with the override', () => {
    const onChange = vi.fn();
    const m = matchup();
    render(<PlayerPanel matchup={m} built={built} snapshot={snapshot} onChange={onChange} />);
    select();
    fireEvent.click(screen.getByTestId('level-good'));
    expect(onChange).toHaveBeenLastCalledWith({
      ...m,
      overrides: [{ side: 'offense', label: 'Z', preset: 'good' }],
    });
    fireEvent.click(screen.getByTestId('level-weak'));
    expect(onChange.mock.calls.at(-1)![0].overrides).toEqual([
      { side: 'offense', label: 'Z', preset: 'weak' },
    ]);
  });

  it('aria-pressed reflects the current level (default avg, then override)', () => {
    const { rerender } = render(
      <PlayerPanel matchup={matchup()} built={built} snapshot={snapshot} onChange={vi.fn()} />,
    );
    select();
    expect(screen.getByTestId('level-avg')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('level-weak')).toHaveAttribute('aria-pressed', 'false');
    rerender(
      <PlayerPanel
        matchup={matchup([{ side: 'offense', label: 'Z', preset: 'good' }])}
        built={built}
        snapshot={snapshot}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('level-good')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('level-avg')).toHaveAttribute('aria-pressed', 'false');
    // sanity: presets differ so the classification is meaningful
    expect(DEFAULT_PRESETS.good).not.toEqual(DEFAULT_PRESETS.avg);
  });

  it('keys 1/2/3 set weak/avg/good for the selected player', () => {
    const onChange = vi.fn();
    render(<PlayerPanel matchup={matchup()} built={built} snapshot={snapshot} onChange={onChange} />);
    select('Y');
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '3' });
    expect(onChange.mock.calls.map((c) => c[0].overrides[0].preset)).toEqual(['weak', 'avg', 'good']);
    expect(onChange.mock.calls[0]![0].overrides[0].label).toBe('Y');
  });

  it('keys are ignored inside inputs and without a selection', () => {
    const onChange = vi.fn();
    render(<PlayerPanel matchup={matchup()} built={built} snapshot={snapshot} onChange={onChange} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(onChange).not.toHaveBeenCalled();
    select();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '2' });
    input.remove();
    expect(onChange).not.toHaveBeenCalled();
  });
});
