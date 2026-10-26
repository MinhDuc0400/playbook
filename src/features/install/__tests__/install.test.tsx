import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installsRepo } from '@/db/repos/installs';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createPlay } from '@/domain/formations';
import { SCHEMA_VERSION, type Install } from '@/domain/types';
import { createMatchup } from '@/features/matchup/buildSimInput';
import { AddToInstallButton } from '../AddToInstallButton';
import InstallDetailPage from '../InstallDetailPage';
import InstallListPage from '../InstallListPage';
import { sortedItems } from '../items';

const ex = vi.hoisted(() => ({
  pdf: vi.fn(async () => {}),
  bundle: vi.fn(async () => ({
    app: 'flagbook',
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    data: {},
  })),
}));
vi.mock('@/lib/export/pdf', () => ({ exportInstallPdf: ex.pdf }));
vi.mock('@/lib/export/selective', () => ({ exportInstallBundle: ex.bundle }));

let n = 0;
const idGen = () => `g${++n}`;

function Where(): JSX.Element {
  return <div data-testid="where">{useLocation().pathname}</div>;
}
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/install" element={<InstallListPage />} />
        <Route path="/install/:id" element={<InstallDetailPage />} />
        <Route path="/install/:id/present" element={<p>present</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const mkInstall = (over: Partial<Install> = {}): Install => ({
  id: 'inst1',
  schemaVersion: SCHEMA_VERSION,
  name: 'Week 1',
  items: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

async function seedMatchups(count: number): Promise<string[]> {
  const off = createPlay({ side: 'offense', format: '5v5', formationId: '5v5-off-2x1', now: 1, idGen });
  const def = createPlay({ side: 'defense', format: '5v5', formationId: '5v5-def-cover-2', now: 1, idGen });
  await playsRepo.put({ ...off, name: 'Smash' });
  await playsRepo.put({ ...def, name: 'Zone2' });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = createMatchup({ offensePlayId: off.id, defensePlayId: def.id, now: 1, idGen });
    await matchupsRepo.put({ ...m, name: `M${i + 1}` });
    ids.push(m.id);
  }
  return ids;
}

const itemIds = async () => sortedItems((await installsRepo.get('inst1'))!).map((i) => i.id);

beforeEach(async () => {
  for (const i of await installsRepo.list()) await installsRepo.remove(i.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
});

describe('InstallListPage (FR-IN-01)', () => {
  it('creates an install and navigates; deletes with confirm', async () => {
    const user = userEvent.setup();
    renderAt('/install');
    await user.type(await screen.findByTestId('install-new-name'), 'Red zone');
    await user.type(screen.getByTestId('install-new-desc'), 'desc');
    await user.click(screen.getByTestId('install-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/install\/.+/));
    const id = screen.getByTestId('where').textContent!.replace('/install/', '');
    const stored = await installsRepo.get(id);
    expect(stored).toMatchObject({ name: 'Red zone', description: 'desc', items: [] });
    expect(await screen.findByTestId('install-detail-page')).toBeInTheDocument();

    await user.click(screen.getByText('Về danh sách Install'));
    expect(await screen.findByTestId(`install-row-${id}`)).toHaveTextContent('0 matchup');
    await user.click(screen.getByTestId(`install-delete-${id}`));
    expect(await installsRepo.get(id)).toBeDefined();
    await user.click(screen.getByTestId('install-delete-confirm'));
    await waitFor(async () => expect(await installsRepo.get(id)).toBeUndefined());
  });
});

describe('InstallDetailPage (FR-IN-02, FR-IN-03)', () => {
  it('shows not-found for an unknown id', async () => {
    renderAt('/install/nope');
    expect(await screen.findByTestId('install-not-found')).toBeInTheDocument();
  });

  it('adds 3 matchups via the picker, reorders by buttons and drop, removes, edits note', async () => {
    const user = userEvent.setup();
    const mids = await seedMatchups(3);
    await installsRepo.put(mkInstall());
    renderAt('/install/inst1');
    await user.click(await screen.findByTestId('install-add'));
    for (const id of mids) await user.click(await screen.findByTestId(`picker-${id}`));
    await user.click(screen.getByTestId('picker-confirm'));

    await waitFor(async () => expect((await installsRepo.get('inst1'))!.items).toHaveLength(3), {
      timeout: 3000,
    });
    let ids = await itemIds();
    expect(sortedItems((await installsRepo.get('inst1'))!).map((i) => i.matchupId)).toEqual(mids);
    const [a, b, c] = ids as [string, string, string];

    await user.click(screen.getByTestId(`install-down-${a}`));
    await waitFor(async () => expect(await itemIds()).toEqual([b, a, c]), { timeout: 3000 });
    await user.click(screen.getByTestId(`install-up-${c}`));
    await waitFor(async () => expect(await itemIds()).toEqual([b, c, a]), { timeout: 3000 });

    // HTML5 drag-and-drop: drop `a` (index 2) onto the first row.
    fireEvent.dragStart(screen.getByTestId(`install-item-${a}`));
    fireEvent.dragOver(screen.getByTestId(`install-item-${b}`));
    fireEvent.drop(screen.getByTestId(`install-item-${b}`));
    await waitFor(async () => expect(await itemIds()).toEqual([a, b, c]), { timeout: 3000 });

    await user.type(screen.getByTestId(`install-note-${b}`), '- watch the corner');
    await waitFor(
      async () =>
        expect((await installsRepo.get('inst1'))!.items.find((i) => i.id === b)?.coachNote).toBe(
          '- watch the corner',
        ),
      { timeout: 3000 },
    );

    await user.click(screen.getByTestId(`install-remove-${a}`));
    await waitFor(async () => expect(await itemIds()).toEqual([b, c]), { timeout: 3000 });
    ids = await itemIds();
    expect((await installsRepo.get('inst1'))!.items.map((i) => i.order).sort()).toEqual([0, 1]);
    expect(screen.getByTestId('install-present')).toHaveAttribute('href', '/install/inst1/present');
  }, 20000);

  it('shows an error label for a missing matchup without crashing', async () => {
    await installsRepo.put(mkInstall({ items: [{ id: 'x1', matchupId: 'gone', order: 0 }] }));
    renderAt('/install/inst1');
    expect(await screen.findByTestId('install-item-x1')).toHaveTextContent('Matchup không còn tồn tại');
  });
});

describe('AddToInstallButton (FR-IN-02)', () => {
  it('appends an item to the chosen install', async () => {
    const user = userEvent.setup();
    const [mid] = await seedMatchups(1);
    await installsRepo.put(mkInstall({ items: [{ id: 'old', matchupId: mid!, order: 0 }] }));
    render(<AddToInstallButton matchupId={mid!} />);
    await user.click(screen.getByTestId('btn-add-to-install'));
    await user.click(await screen.findByTestId('add-to-install-inst1'));
    await waitFor(async () => expect((await installsRepo.get('inst1'))!.items).toHaveLength(2));
    const items = sortedItems((await installsRepo.get('inst1'))!);
    expect(items.map((i) => i.order)).toEqual([0, 1]);
    expect(items[1]!.matchupId).toBe(mid);
  });
});

describe('install export buttons (FR-IN-06, FR-IO-06)', () => {
  it('call the exporters', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    await installsRepo.put(mkInstall());
    const user = userEvent.setup();
    renderAt('/install/inst1');
    await user.click(await screen.findByTestId('install-export-pdf'));
    expect(ex.pdf).toHaveBeenCalledWith('inst1');
    await user.click(screen.getByTestId('install-export-json'));
    await waitFor(() => expect(ex.bundle).toHaveBeenCalledWith('inst1'));
  });
});
