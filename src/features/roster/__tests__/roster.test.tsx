import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { athletesRepo, lineupsRepo } from '@/db/repos';
import { DEFAULT_PRESETS } from '@/domain/presets';
import { SCHEMA_VERSION } from '@/domain/types';
import RosterPage from '../RosterPage';

beforeEach(async () => {
  for (const a of await athletesRepo.list()) await athletesRepo.remove(a.id);
  for (const l of await lineupsRepo.list()) await lineupsRepo.remove(l.id);
});

describe('RosterPage athletes (FR-ATH-04)', () => {
  it('creates with preset Hay, edits a stat -> custom, deletes and clears lineup refs', async () => {
    const user = userEvent.setup();
    render(<RosterPage />);
    await user.click(await screen.findByTestId('athlete-new'));
    await user.type(screen.getByTestId('athlete-name'), 'Minh');
    await user.click(screen.getByTestId('athlete-pos-WR'));
    await user.selectOptions(screen.getByTestId('athlete-preset'), 'good');
    await user.click(screen.getByTestId('athlete-save'));
    await waitFor(async () => expect(await athletesRepo.list()).toHaveLength(1));
    const a = (await athletesRepo.list())[0]!;
    expect(a).toMatchObject({
      name: 'Minh',
      preset: 'good',
      positions: ['WR'],
      schemaVersion: SCHEMA_VERSION,
    });
    expect(a.stats).toEqual(DEFAULT_PRESETS.good);
    expect(await screen.findByTestId(`athlete-level-${a.id}`)).toHaveAttribute('data-level', 'good');

    await user.click(screen.getByTestId(`athlete-row-${a.id}`));
    const speed = screen.getByTestId('athlete-stat-speed');
    await user.clear(speed);
    await user.type(speed, '9');
    expect(screen.getByTestId('athlete-preset')).toHaveValue('custom');
    await user.click(screen.getByTestId('athlete-save'));
    await waitFor(async () => expect((await athletesRepo.get(a.id))?.preset).toBe('custom'));
    expect((await athletesRepo.get(a.id))?.stats.speed).toBe(9);
    expect(await screen.findByTestId(`athlete-level-${a.id}`)).toHaveAttribute('data-level', 'custom');

    await lineupsRepo.put({
      id: 'l1',
      schemaVersion: SCHEMA_VERSION,
      name: 'L',
      side: 'offense',
      format: '5v5',
      slots: [
        { label: 'X', athleteId: a.id },
        { label: 'Z', preset: 'avg' },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    await user.click(screen.getByTestId(`athlete-delete-${a.id}`));
    expect(await athletesRepo.get(a.id)).toBeDefined();
    await user.click(await screen.findByTestId('athlete-delete-confirm'));
    await waitFor(async () => expect(await athletesRepo.get(a.id)).toBeUndefined());
    const l = (await lineupsRepo.get('l1'))!;
    expect(l.slots[0]).toEqual({ label: 'X' });
    expect(l.slots[1]).toEqual({ label: 'Z', preset: 'avg' });
  });
});

describe('RosterPage lineups (FR-ATH-05)', () => {
  it('creates defense 5v5 Cover 2 lineup and assigns athlete + Kém', async () => {
    const user = userEvent.setup();
    await athletesRepo.put({
      id: 'a1',
      schemaVersion: SCHEMA_VERSION,
      name: 'Bao',
      preset: 'avg',
      stats: { ...DEFAULT_PRESETS.avg },
      positions: ['CB'],
      createdAt: 1,
      updatedAt: 1,
    });
    render(<RosterPage />);
    await user.click(screen.getByTestId('tab-lineups'));
    await user.type(await screen.findByTestId('lineup-new-name'), 'D1');
    await user.selectOptions(screen.getByTestId('lineup-new-side'), 'defense');
    await user.selectOptions(screen.getByTestId('lineup-new-format'), '5v5');
    await user.selectOptions(screen.getByTestId('lineup-new-formation'), '5v5-def-cover-2');
    await user.click(screen.getByTestId('lineup-create'));
    await user.selectOptions(await screen.findByTestId('lineup-assign-CB1'), 'a:a1');
    await user.selectOptions(screen.getByTestId('lineup-assign-S1'), 'p:weak');
    await user.click(screen.getByTestId('lineup-save'));
    await waitFor(async () => expect(await lineupsRepo.list()).toHaveLength(1));
    const l = (await lineupsRepo.list())[0]!;
    expect(l).toMatchObject({ name: 'D1', side: 'defense', format: '5v5' });
    expect(l.slots).toEqual([
      { label: 'CB1', athleteId: 'a1' },
      { label: 'CB2', preset: 'avg' },
      { label: 'S1', preset: 'weak' },
      { label: 'S2', preset: 'avg' },
      { label: 'R1', preset: 'avg' },
    ]);
  });

  it('switches tabs', async () => {
    const user = userEvent.setup();
    render(<RosterPage />);
    expect(await screen.findByTestId('athletes-tab')).toBeInTheDocument();
    await user.click(screen.getByTestId('tab-lineups'));
    expect(screen.getByTestId('lineups-tab')).toBeInTheDocument();
    await user.click(screen.getByTestId('tab-athletes'));
    expect(screen.getByTestId('athletes-tab')).toBeInTheDocument();
  });
});
