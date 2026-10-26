import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSettings } from '@/db/__tests__/fixtures';
import { settingsRepo } from '@/db/repos';
import { DEFAULT_TUNING } from '@/domain/defaults';
import { TuningSection } from '../TuningSection';

beforeEach(async () => {
  await settingsRepo.put(makeSettings());
});

describe('FR-TUN-01 tuning section', () => {
  it('changing a number persists and reset restores defaults', async () => {
    const user = userEvent.setup();
    render(<TuningSection />);
    fireEvent.change(await screen.findByTestId('tuning-ballSpeed'), { target: { value: '22' } });
    await waitFor(async () => expect((await settingsRepo.get())?.tuning.ballSpeed).toBe(22));
    await user.click(screen.getByTestId('tuning-reset'));
    await waitFor(async () => expect((await settingsRepo.get())?.tuning).toEqual(DEFAULT_TUNING));
  });

  it('slider commits and per-row reset restores one key; simDt is read-only', async () => {
    const user = userEvent.setup();
    render(<TuningSection />);
    fireEvent.change(await screen.findByTestId('tuning-slider-intShare'), { target: { value: '0.8' } });
    await waitFor(async () => expect((await settingsRepo.get())?.tuning.intShare).toBe(0.8));
    await user.click(screen.getByTestId('tuning-reset-intShare'));
    await waitFor(async () =>
      expect((await settingsRepo.get())?.tuning.intShare).toBe(DEFAULT_TUNING.intShare),
    );
    expect(screen.getByTestId('tuning-simDt').tagName).toBe('SPAN');
  });

  it('out-of-range value is ignored', async () => {
    render(<TuningSection />);
    fireEvent.change(await screen.findByTestId('tuning-ballSpeed'), { target: { value: '500' } });
    await new Promise((r) => setTimeout(r, 450));
    expect((await settingsRepo.get())?.tuning.ballSpeed).toBe(DEFAULT_TUNING.ballSpeed);
  });
});
