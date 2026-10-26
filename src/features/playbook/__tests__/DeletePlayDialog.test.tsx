import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeInstall, makeMatchup, makePlay } from '@/db/__tests__/fixtures';
import { installsRepo, matchupsRepo, playsRepo } from '@/db/repos';
import { DeletePlayDialog } from '../DeletePlayDialog';

const o1 = makePlay('o1');
const d1 = makePlay('d1', { side: 'defense' });

async function clearAll(): Promise<void> {
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const i of await installsRepo.list()) await installsRepo.remove(i.id);
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
}

beforeEach(async () => {
  await clearAll();
  await playsRepo.bulkPut([o1, d1, makePlay('lonely')]);
});

describe('DeletePlayDialog (FR-DAT-02)', () => {
  it('unused play: confirm deletes it', async () => {
    const onClose = vi.fn();
    render(<DeletePlayDialog play={makePlay('lonely')} open onClose={onClose} />);
    await userEvent.setup().click(await screen.findByTestId('delete-confirm'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await playsRepo.get('lonely')).toBeUndefined();
  });

  it('used play: lists matchups and installs; cancel keeps everything', async () => {
    await matchupsRepo.put(makeMatchup('m1', 'o1', 'd1'));
    await installsRepo.put(makeInstall('iA', ['m1']));
    const onClose = vi.fn();
    render(<DeletePlayDialog play={o1} open onClose={onClose} />);
    expect(await screen.findByTestId('delete-impact-m1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-install-iA')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-confirm')).toBeNull();
    await userEvent.setup().click(screen.getByTestId('delete-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(await playsRepo.get('o1')).toBeDefined();
    expect(await matchupsRepo.get('m1')).toBeDefined();
    expect((await installsRepo.get('iA'))?.items).toHaveLength(1);
  });

  it('cascade deletes play + matchups and removes install items', async () => {
    await matchupsRepo.bulkPut([makeMatchup('m1', 'o1', 'd1'), makeMatchup('m2', 'o1', 'd1')]);
    await installsRepo.put(makeInstall('iA', ['m1', 'm2']));
    const onClose = vi.fn();
    render(<DeletePlayDialog play={o1} open onClose={onClose} />);
    await userEvent.setup().click(await screen.findByTestId('delete-cascade'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await playsRepo.get('o1')).toBeUndefined();
    expect(await matchupsRepo.list()).toHaveLength(0);
    expect((await installsRepo.get('iA'))?.items).toHaveLength(0);
    expect(await playsRepo.get('d1')).toBeDefined();
  });
});
