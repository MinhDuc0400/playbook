import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSettings } from '@/db/__tests__/fixtures';
import { settingsRepo } from '@/db/repos';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { PresetsSection } from '../PresetsSection';

beforeEach(async () => {
  await settingsRepo.put(makeSettings());
});

describe('FR-TUN-02 presets section', () => {
  it('valid edit persists, invalid ignored, reset restores defaults', async () => {
    const user = userEvent.setup();
    render(<PresetsSection />);
    const input = await screen.findByTestId('preset-weak-speed');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.change(input, { target: { value: '5.5' } });
    await waitFor(async () => expect((await settingsRepo.get())?.presets.weak.speed).toBe(5.5));
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.change(screen.getByTestId('preset-good-iq'), { target: { value: '1.5' } });
    await new Promise((r) => setTimeout(r, 100));
    const s = await settingsRepo.get();
    expect(s?.presets.weak.speed).toBe(5.5);
    expect(s?.presets.good.iq).toBe(DEFAULT_PRESETS.good.iq);
    await user.click(screen.getByTestId('presets-reset'));
    await waitFor(async () => expect((await settingsRepo.get())?.presets).toEqual(DEFAULT_PRESETS));
  });
});
