import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Matchup } from '@/domain/types';
import { createMatchup } from '../buildSimInput';
import { ControlsPanel } from '../ControlsPanel';

const base = createMatchup({ offensePlayId: 'o', defensePlayId: 'd', now: 1, idGen: () => 'm', seed: 7 });

function setup() {
  const onChange = vi.fn();
  const utils = render(<ControlsPanel matchup={base} onChange={onChange} />);
  return { onChange, ...utils };
}

describe('ControlsPanel (FR-MU-02)', () => {
  it('flip offense, defenseFlip and noise emit updated matchups', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByTestId('ctl-offense-flipped'));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, offenseFlipped: true });
    await user.selectOptions(screen.getByTestId('ctl-defense-flip'), 'flip');
    expect(onChange).toHaveBeenLastCalledWith({ ...base, defenseFlip: 'flip' });
    await user.click(screen.getByTestId('ctl-noise'));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, noise: true });
  });

  it('ball x / yard line apply valid values only', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByTestId('ctl-ball-x'), { target: { value: '3.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...base, ballSpot: { ...base.ballSpot, x: 3.5 } });
    onChange.mockClear();
    fireEvent.change(screen.getByTestId('ctl-ball-x'), { target: { value: '25' } });
    fireEvent.change(screen.getByTestId('ctl-ball-x'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('ctl-ball-yardline'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('ctl-ball-yardline'), { target: { value: '12.5' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('ctl-ball-yardline'), { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...base, ballSpot: { ...base.ballSpot, yardLine: 30 } });
  });

  it('seed input applies integers; dice picks a new seed', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    fireEvent.change(screen.getByTestId('ctl-seed'), { target: { value: '42' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...base, seed: 42 });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await user.click(screen.getByTestId('ctl-seed-dice'));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, seed: 2 ** 30 });
    vi.restoreAllMocks();
  });

  it('shows the dice seed in the input when the matchup changes', async () => {
    const user = userEvent.setup();
    function Host(): JSX.Element {
      const [m, setM] = useState<Matchup>(base);
      return <ControlsPanel matchup={m} onChange={setM} />;
    }
    render(<Host />);
    expect(screen.getByTestId('ctl-seed')).toHaveValue(7);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    await user.click(screen.getByTestId('ctl-seed-dice'));
    expect(screen.getByTestId('ctl-seed')).toHaveValue(2 ** 29);
    vi.restoreAllMocks();
  });
});

describe('ControlsPanel anticipation (FR-MU-10)', () => {
  it('slider emits anticipation; datalist has 0 / 0.5 / 1 ticks', () => {
    const { onChange, container } = setup();
    const slider = screen.getByTestId('ctl-anticipation');
    expect(slider).toHaveAttribute('step', '0.05');
    fireEvent.change(slider, { target: { value: '0.25' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...base, anticipation: 0.25 });
    const values = Array.from(container.querySelectorAll('datalist option')).map((o) =>
      o.getAttribute('value'),
    );
    expect(values).toEqual(['0', '0.5', '1']);
  });

  it('Oracle label shows only above 0.5', () => {
    const { rerender } = render(
      <ControlsPanel matchup={{ ...base, anticipation: 0.5 }} onChange={vi.fn()} />,
    );
    expect(screen.queryByTestId('ctl-oracle-label')).toBeNull();
    rerender(<ControlsPanel matchup={{ ...base, anticipation: 0.55 }} onChange={vi.fn()} />);
    expect(screen.getByTestId('ctl-oracle-label')).toHaveTextContent('Oracle: defense biết trước');
  });
});

describe('ControlsPanel lineup selects (FR-ATH-06)', () => {
  const mk = (id: string, side: 'offense' | 'defense', format: '5v5' | '7v7') => ({
    id,
    schemaVersion: 1,
    name: `L-${id}`,
    side,
    format,
    slots: [],
    createdAt: 1,
    updatedAt: 1,
  });

  it('lists only lineups of the side and format; choosing sets the id, "none" clears it', async () => {
    const user = userEvent.setup();
    const { lineupsRepo } = await import('@/db/repos/lineups');
    for (const l of await lineupsRepo.list()) await lineupsRepo.remove(l.id);
    await lineupsRepo.put(mk('o5', 'offense', '5v5'));
    await lineupsRepo.put(mk('o7', 'offense', '7v7'));
    await lineupsRepo.put(mk('d5', 'defense', '5v5'));
    const onChange = vi.fn();
    const { rerender } = render(<ControlsPanel matchup={base} format="5v5" onChange={onChange} />);
    const off = screen.getByTestId('ctl-lineup-offense') as HTMLSelectElement;
    await waitFor(() => expect(off.options.length).toBe(2));
    expect([...off.options].map((o) => o.value)).toEqual(['', 'o5']);
    const def = screen.getByTestId('ctl-lineup-defense') as HTMLSelectElement;
    expect([...def.options].map((o) => o.value)).toEqual(['', 'd5']);
    await user.selectOptions(off, 'o5');
    expect(onChange).toHaveBeenLastCalledWith({ ...base, offenseLineupId: 'o5' });
    rerender(<ControlsPanel matchup={{ ...base, offenseLineupId: 'o5' }} format="5v5" onChange={onChange} />);
    await user.selectOptions(screen.getByTestId('ctl-lineup-offense'), '');
    expect(onChange.mock.calls.at(-1)![0]).toEqual(base);
    expect('offenseLineupId' in onChange.mock.calls.at(-1)![0]).toBe(false);
  });
});
