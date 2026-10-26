import { fireEvent, render, screen } from '@testing-library/react';
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
