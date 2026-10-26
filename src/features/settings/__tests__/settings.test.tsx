import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlay, makeSettings } from '@/db/__tests__/fixtures';
import { athletesRepo, installsRepo, lineupsRepo, matchupsRepo, playsRepo, settingsRepo } from '@/db/repos';
import { SCHEMA_VERSION } from '@/domain/types';
import { exportAll } from '@/lib/io/exportData';
import SettingsPage from '../SettingsPage';

// jsdom's File lacks text(); polyfill it for the tests.
if (typeof File.prototype.text !== 'function') {
  File.prototype.text = function text(this: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

async function clearAll(): Promise<void> {
  for (const repo of [playsRepo, athletesRepo, lineupsRepo, matchupsRepo, installsRepo]) {
    for (const r of await repo.list()) await repo.remove(r.id);
  }
}

function jsonFile(obj: unknown): File {
  return new File([JSON.stringify(obj)], 'backup.json', { type: 'application/json' });
}

function validFile(playIds: string[]): unknown {
  return {
    app: 'flagbook',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { plays: playIds.map((id) => makePlay(id)) },
  };
}

beforeEach(async () => {
  await clearAll();
  await settingsRepo.put(makeSettings());
});

describe('SettingsPage', () => {
  it('theme select persists ui.theme', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.selectOptions(await screen.findByTestId('settings-theme'), 'dark');
    await waitFor(async () => expect((await settingsRepo.get())?.ui.theme).toBe('dark'));
    await user.click(screen.getByTestId('settings-snap'));
    await waitFor(async () => expect((await settingsRepo.get())?.ui.snap).toBe(false));
  });
});

describe('DataSection', () => {
  it('export downloads a file and sets lastExportAt', async () => {
    const user = userEvent.setup();
    await playsRepo.put(makePlay('p1'));
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<SettingsPage />);
    await user.click(await screen.findByTestId('btn-export'));
    await waitFor(async () => expect((await settingsRepo.get())?.lastExportAt).toBeTypeOf('number'));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('merge import shows the report', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.upload(await screen.findByTestId('import-file'), jsonFile(validFile(['a', 'b'])));
    await user.click(screen.getByTestId('btn-import'));
    const report = await screen.findByTestId('import-report');
    expect(within(screen.getByTestId('import-report-plays')).getAllByRole('cell')[1]).toHaveTextContent('2');
    expect(report).toBeInTheDocument();
    expect(await playsRepo.count()).toBe(2);
  });

  it('replace needs confirmation', async () => {
    const user = userEvent.setup();
    await playsRepo.put(makePlay('old'));
    render(<SettingsPage />);
    await user.upload(await screen.findByTestId('import-file'), jsonFile(validFile(['new'])));
    await user.click(screen.getByTestId('import-mode-replace'));
    await user.click(screen.getByTestId('btn-import'));
    expect(await screen.findByTestId('import-confirm')).toBeInTheDocument();
    expect((await playsRepo.list()).map((p) => p.id)).toEqual(['old']);
    await user.click(screen.getByTestId('import-confirm-yes'));
    await screen.findByTestId('import-report');
    expect((await playsRepo.list()).map((p) => p.id)).toEqual(['new']);
  });

  it('invalid file shows errors and writes nothing', async () => {
    const user = userEvent.setup();
    await playsRepo.put(makePlay('keep'));
    render(<SettingsPage />);
    await user.upload(await screen.findByTestId('import-file'), jsonFile({ app: 'nope' }));
    await user.click(screen.getByTestId('btn-import'));
    expect(await screen.findByTestId('import-errors')).toBeInTheDocument();
    expect(screen.queryByTestId('import-report')).toBeNull();
    expect((await playsRepo.list()).map((p) => p.id)).toEqual(['keep']);
    expect((await exportAll()).data.plays).toHaveLength(1);
  });
});
