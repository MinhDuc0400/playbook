import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeSettings } from '@/db/__tests__/fixtures';
import { playsRepo, settingsRepo } from '@/db/repos';
import { createSamplePlays } from '@/db/seed/samplePlays';
import { BenchmarkSection } from '../BenchmarkSection';

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  await settingsRepo.put(makeSettings());
  await playsRepo.bulkPut(createSamplePlays(1));
});

describe('FR-TUN-03 benchmark section', () => {
  it('runs 9 pairs, marks 3 target rows', async () => {
    const user = userEvent.setup();
    render(<BenchmarkSection />);
    await user.selectOptions(await screen.findByTestId('bench-runs'), '10');
    await waitFor(() => expect(screen.getByTestId('bench-run')).toBeEnabled());
    await user.click(screen.getByTestId('bench-run'));
    await waitFor(() => expect(screen.getByTestId('bench-progress')).toHaveTextContent('Xong 9'), {
      timeout: 60_000,
    });
    const table = screen.getByTestId('bench-table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(9);
    expect(table.querySelectorAll('tr[data-target="true"]')).toHaveLength(3);
    expect(table.querySelectorAll('[data-testid^="bench-ok-"]')).toHaveLength(3);
    expect(table.querySelector('tbody tr td:nth-child(3)')?.textContent).toMatch(/^\d+ %$/);
  }, 90_000);

  it('cancel stops early', async () => {
    const user = userEvent.setup();
    render(<BenchmarkSection />);
    await waitFor(() => expect(screen.getByTestId('bench-run')).toBeEnabled());
    await user.click(screen.getByTestId('bench-run'));
    await user.click(await screen.findByTestId('bench-cancel'));
    await waitFor(() => expect(screen.getByTestId('bench-progress')).toHaveTextContent('Đã hủy'), {
      timeout: 60_000,
    });
    expect(screen.queryAllByTestId(/^bench-row-/).length).toBeLessThan(9);
  }, 90_000);
});
