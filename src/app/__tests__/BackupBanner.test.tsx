import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlay } from '@/db/__tests__/fixtures';
import { playsRepo, settingsRepo } from '@/db/repos';
import { resetDb } from '@/db/schema';
import { BackupBanner } from '../BackupBanner';

const dl = vi.hoisted(() => ({ downloadExport: vi.fn(async () => {}) }));
vi.mock('@/lib/io/exportData', async (orig) => ({
  ...(await orig<typeof import('@/lib/io/exportData')>()),
  downloadExport: dl.downloadExport,
}));

const show = () =>
  render(
    <MemoryRouter>
      <BackupBanner />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await resetDb();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('FR-IO-05 BackupBanner', () => {
  it('hidden with only seed data', async () => {
    await playsRepo.put(makePlay('seed-x'));
    show();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });

  it('shown with user data and no lastExportAt; export-now downloads', async () => {
    await playsRepo.put(makePlay('u1'));
    const user = userEvent.setup();
    show();
    await screen.findByTestId('backup-banner');
    await user.click(screen.getByTestId('backup-export-now'));
    await waitFor(() => expect(dl.downloadExport).toHaveBeenCalledTimes(1));
  });

  it('shown when export is older than 14 days', async () => {
    await playsRepo.put(makePlay('u1'));
    await settingsRepo.update({ lastExportAt: Date.now() - 15 * 86_400_000 });
    show();
    await screen.findByTestId('backup-banner');
  });

  it('hidden when exported recently', async () => {
    await playsRepo.put(makePlay('u1'));
    await settingsRepo.update({ lastExportAt: Date.now() - 86_400_000 });
    show();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });

  it('dismiss hides for the session', async () => {
    await playsRepo.put(makePlay('u1'));
    const user = userEvent.setup();
    const first = show();
    await screen.findByTestId('backup-banner');
    await user.click(screen.getByTestId('backup-dismiss'));
    expect(screen.queryByTestId('backup-banner')).toBeNull();
    first.unmount();
    show();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('backup-banner')).toBeNull();
  });
});
