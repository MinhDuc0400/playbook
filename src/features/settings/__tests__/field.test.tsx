import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSettings } from '@/db/__tests__/fixtures';
import { settingsRepo } from '@/db/repos';
import { createDefaultFields } from '@/domain/field';
import { FieldSection } from '../FieldSection';

beforeEach(async () => {
  await settingsRepo.put(makeSettings());
});

describe('FR-TUN-02 field section', () => {
  it('edits persist for the chosen format only; reset restores it', async () => {
    const user = userEvent.setup();
    render(<FieldSection />);
    await user.selectOptions(await screen.findByTestId('field-format'), '7v7');
    fireEvent.change(screen.getByTestId('field-passClock'), { target: { value: '5' } });
    await user.click(screen.getByTestId('field-qbCanCrossLOS'));
    await waitFor(async () => {
      const s = await settingsRepo.get();
      expect(s?.fields['7v7'].passClock).toBe(5);
      expect(s?.fields['7v7'].qbCanCrossLOS).toBe(true);
    });
    expect((await settingsRepo.get())?.fields['5v5'].passClock).toBe(7);
    fireEvent.change(screen.getByTestId('field-playersPerSide'), { target: { value: '2' } });
    await new Promise((r) => setTimeout(r, 50));
    expect((await settingsRepo.get())?.fields['7v7'].playersPerSide).toBe(7);
    await user.click(screen.getByTestId('field-reset'));
    await waitFor(async () =>
      expect((await settingsRepo.get())?.fields['7v7']).toEqual(createDefaultFields()['7v7']),
    );
  });

  it('default format select persists', async () => {
    const user = userEvent.setup();
    render(<FieldSection />);
    await user.selectOptions(await screen.findByTestId('field-default-format'), '7v7');
    await waitFor(async () => expect((await settingsRepo.get())?.defaultFormat).toBe('7v7'));
  });
});
