import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installsRepo } from '@/db/repos/installs';
import { matchupsRepo } from '@/db/repos/matchups';
import { playsRepo } from '@/db/repos/plays';
import { createPlay } from '@/domain/formations';
import { SCHEMA_VERSION, type Install } from '@/domain/types';
import { createMatchup } from '@/features/matchup/buildSimInput';
import PresentPage from '../PresentPage';

let n = 0;
const idGen = () => `p${++n}`;

function Where(): JSX.Element {
  return <div data-testid="where">{useLocation().pathname}</div>;
}
function renderPresent(id = 'inst1') {
  return render(
    <MemoryRouter initialEntries={[`/install/${id}/present`]}>
      <Where />
      <Routes>
        <Route path="/install/:id/present" element={<PresentPage />} />
        <Route path="/install/:id" element={<p>detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function seed(extraItems: Install['items'] = []): Promise<void> {
  const off = createPlay({ side: 'offense', format: '5v5', formationId: '5v5-off-2x1', now: 1, idGen });
  const def = createPlay({ side: 'defense', format: '5v5', formationId: '5v5-def-cover-2', now: 1, idGen });
  await playsRepo.put({ ...off, name: 'Smash' });
  await playsRepo.put({ ...def, name: 'Zone2' });
  const items: Install['items'] = [];
  for (let i = 0; i < 3; i++) {
    const m = createMatchup({ offensePlayId: off.id, defensePlayId: def.id, now: 1, idGen });
    await matchupsRepo.put({ ...m, name: `M${i + 1}` });
    items.push({ id: `it${i + 1}`, matchupId: m.id, order: i, coachNote: i === 0 ? 'Note one' : undefined });
  }
  await installsRepo.put({
    id: 'inst1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Week 1',
    items: [...items, ...extraItems],
    createdAt: 1,
    updatedAt: 1,
  });
}

beforeEach(async () => {
  for (const i of await installsRepo.list()) await installsRepo.remove(i.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
});

const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }));

describe('PresentPage (FR-IN-04)', () => {
  it('shows not-found for an unknown install', async () => {
    renderPresent('nope');
    expect(await screen.findByTestId('present-not-found')).toBeInTheDocument();
  });

  it('navigates items with arrows and buttons, clamped at the ends', async () => {
    await seed();
    renderPresent();
    expect(await screen.findByTestId('present-index')).toHaveTextContent('1 / 3');
    expect(await screen.findByTestId('matchup-field')).toBeInTheDocument();
    expect(await screen.findByTestId('open-windows')).toBeInTheDocument();
    expect(await screen.findByTestId('present-title')).toHaveTextContent('M1');
    key('ArrowLeft');
    expect(screen.getByTestId('present-index')).toHaveTextContent('1 / 3');
    key('ArrowRight');
    expect(screen.getByTestId('present-index')).toHaveTextContent('2 / 3');
    await waitFor(() => expect(screen.getByTestId('present-title')).toHaveTextContent('M2'));
    fireEvent.click(screen.getByTestId('present-next'));
    key('ArrowRight');
    expect(screen.getByTestId('present-index')).toHaveTextContent('3 / 3');
    fireEvent.click(screen.getByTestId('present-prev'));
    expect(screen.getByTestId('present-index')).toHaveTextContent('2 / 3');
    key('ArrowLeft');
    expect(screen.getByTestId('present-index')).toHaveTextContent('1 / 3');
  });

  it('N toggles notes, L toggles loop, Space toggles play, Escape exits', async () => {
    await seed();
    renderPresent();
    expect(await screen.findByTestId('present-notes')).toHaveTextContent('Note one');
    key('n');
    expect(screen.queryByTestId('present-notes')).toBeNull();
    key('N');
    expect(screen.getByTestId('present-notes')).toBeInTheDocument();

    const loop = screen.getByTestId('present-loop');
    expect(loop).toHaveAttribute('aria-pressed', 'false');
    key('l');
    expect(loop).toHaveAttribute('aria-pressed', 'true');

    await screen.findByTestId('btn-play');
    const before = screen.getByTestId('btn-play').getAttribute('aria-label');
    key(' ');
    expect(screen.getByTestId('btn-play').getAttribute('aria-label')).not.toBe(before);
    key(' ');
    expect(screen.getByTestId('btn-play').getAttribute('aria-label')).toBe(before);

    key('Escape');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/install/inst1'));
  });

  it('FR-IN-05 contrast toggle switches the field to the high-contrast theme', async () => {
    // Give FieldStage a measurable container so it renders the svg in jsdom.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
    await seed();
    renderPresent();
    await screen.findByTestId('matchup-field');
    const btn = screen.getByTestId('present-contrast');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByTestId('field-svg')).toHaveAttribute('data-theme', 'contrast'));
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('field-svg')).toHaveAttribute('data-theme', 'normal'));
    rect.mockRestore();
  });

  it('shows an item error for a missing matchup and still navigates', async () => {
    await seed();
    const inst = (await installsRepo.get('inst1'))!;
    await installsRepo.put({
      ...inst,
      items: inst.items.map((it) => (it.id === 'it1' ? { ...it, matchupId: 'gone' } : it)),
    });
    renderPresent();
    expect(await screen.findByTestId('present-item-error')).toBeInTheDocument();
    key('ArrowRight');
    expect(await screen.findByTestId('matchup-field')).toBeInTheDocument();
    expect(screen.queryByTestId('present-item-error')).toBeNull();
  });
});

describe('PresentPage on phones (D-25)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders large prev/next buttons in the bottom bar and a toggleable notes sheet', async () => {
    await seed();
    renderPresent();
    const bar = await screen.findByTestId('present-bottom-bar');
    expect(bar).toContainElement(screen.getByTestId('present-prev'));
    expect(bar).toContainElement(screen.getByTestId('present-next'));
    expect(screen.getByTestId('present-next').className).toContain('min-h-12');
    expect(screen.queryByTestId('present-notes')).toBeNull();
    fireEvent.click(screen.getByTestId('present-notes-toggle'));
    expect(await screen.findByTestId('present-notes')).toHaveTextContent('Note one');
    key('n');
    expect(screen.queryByTestId('present-notes')).toBeNull();
    fireEvent.click(screen.getByTestId('present-next'));
    expect(screen.getByTestId('present-index')).toHaveTextContent('2 / 3');
  });
});
