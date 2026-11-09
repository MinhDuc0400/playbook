import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlay, makeSettings } from '@/db/__tests__/fixtures';
import { matchupsRepo, playsRepo, settingsRepo } from '@/db/repos';
import { flipPlay } from '@/domain/flip';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import FreestylePage from '../FreestylePage';
import { BALL_KEY, DRAFT_KEY, loadBallSpot, loadDraft, saveBallSpot } from '../draft';
import { trialMatchup } from '../TrialView';
import { AUTOSAVE_MS, useFreestyleDraft } from '../useFreestyleDraft';

vi.mock('@/db/errors', () => ({ onDbError: vi.fn(() => () => undefined) }));
vi.mock('@/app/BackupBanner', () => ({ BackupBanner: () => null }));

const store = () => useEditorStore.getState();
const off = (): Play => makePlay('o1', { side: 'offense' });
const def = (): Play =>
  makePlay('d1', {
    side: 'defense',
    players: [{ id: 'd1-s1', role: 'CB', label: 'A', start: { x: 4, y: 5 }, actions: [] }],
  });
const stored = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ v: 1, offense: off(), defense: def(), activeSide: 'offense', ...over });

function MatchupStub(): JSX.Element {
  return <div data-testid="matchup-stub">{useParams().id}</div>;
}
async function mount() {
  render(
    <MemoryRouter initialEntries={['/freestyle']}>
      <Routes>
        <Route path="/freestyle" element={<FreestylePage />} />
        <Route path="/matchup/:id" element={<MatchupStub />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('freestyle-page');
}

beforeEach(async () => {
  localStorage.clear();
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  for (const m of await matchupsRepo.list()) await matchupsRepo.remove(m.id);
  await settingsRepo.put(makeSettings());
  store().load(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('T-FS-06 loadDraft', () => {
  it('returns a valid draft', () => {
    localStorage.setItem(DRAFT_KEY, stored({ activeSide: 'defense' }));
    const d = loadDraft();
    expect(d?.activeSide).toBe('defense');
    expect(d?.offense.id).toBe('o1');
  });

  it.each([
    ['absent', null],
    ['not JSON', '{nope'],
    ['null', 'null'],
    ['wrong version', stored({ v: 2 })],
    ['bad side', stored({ activeSide: 'x' })],
    ['invalid play', stored({ offense: { id: 'x' } })],
    ['swapped sides', stored({ offense: def(), defense: off() })],
  ])('rejects %s', (_n, raw) => {
    if (raw !== null) localStorage.setItem(DRAFT_KEY, raw);
    expect(loadDraft()).toBeNull();
  });

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadDraft()).toBeNull();
  });
});

describe('D-48 loadDraft converts an old Bunch Killer draft (Review Focus 4)', () => {
  it('a defense with areaMatch loads with the Bunch Killer rules, not dropped', () => {
    const oldDef = {
      ...def(),
      players: [
        {
          id: 'd1-cb',
          role: 'CB',
          label: 'CB1',
          start: { x: 9, y: 3.5 },
          actions: [],
          areaMatch: { role: 'corner' },
        },
        {
          id: 'd1-s',
          role: 'S',
          label: 'S',
          start: { x: 4, y: 3.5 },
          actions: [],
          areaMatch: { role: 'inside' },
        },
      ],
    };
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: 1, offense: off(), defense: oldDef, activeSide: 'defense' }),
    );
    const d = loadDraft();
    expect(d).not.toBeNull();
    const cb = d!.defense.players.find((p) => p.id === 'd1-cb')!;
    const sf = d!.defense.players.find((p) => p.id === 'd1-s')!;
    expect(cb.matchRules?.[0]?.when).toEqual({
      receiver: { kind: 'nth', n: 1 },
      event: 'entersArea',
      area: { kind: 'self' },
    });
    expect(sf.matchRules?.[0]?.when.area).toEqual({ kind: 'teammate', slotId: 'd1-cb' });
    expect('areaMatch' in cb).toBe(false);
  });
});

describe('T-FS-06 draft restore and autosave', () => {
  it('restores a stored draft on mount', async () => {
    localStorage.setItem(DRAFT_KEY, stored({ activeSide: 'defense' }));
    await mount();
    expect(store().play?.side).toBe('defense');
    expect(store().play?.players).toHaveLength(1);
    expect(store().companion?.players).toHaveLength(2);
  });

  it('falls back to a blank board on a corrupt draft', async () => {
    localStorage.setItem(DRAFT_KEY, '{bad');
    await mount();
    expect(store().play?.players).toHaveLength(0);
    expect(store().companion?.players).toHaveLength(0);
  });

  it('autosave writes once, after the debounce, and not for the initial state', () => {
    vi.useFakeTimers();
    store().loadPair(off(), def(), 'offense');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    function Probe(): null {
      useFreestyleDraft(true);
      return null;
    }
    const { unmount } = render(<Probe />);
    vi.advanceTimersByTime(AUTOSAVE_MS * 2);
    expect(set).not.toHaveBeenCalled();
    act(() => store().apply('edit', (p) => ({ ...p, name: 'one' })));
    act(() => store().apply('edit', (p) => ({ ...p, name: 'two' })));
    vi.advanceTimersByTime(AUTOSAVE_MS - 10);
    expect(set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(set).toHaveBeenCalledTimes(1);
    expect(loadDraft()?.offense.name).toBe('two');
    // pending change is flushed on unmount
    act(() => store().apply('edit', (p) => ({ ...p, name: 'three' })));
    unmount();
    expect(loadDraft()?.offense.name).toBe('three');
  });

  it('Mới removes the stored draft', async () => {
    localStorage.setItem(DRAFT_KEY, stored());
    await mount();
    fireEvent.click(screen.getByTestId('fs-clear'));
    fireEvent.click(screen.getByTestId('fs-clear'));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(store().play?.players).toHaveLength(0);
  });
});

describe('T-FS-06 save as plays', () => {
  it('is disabled when one side is empty', async () => {
    await mount();
    expect(screen.getByTestId('fs-save')).toBeDisabled();
    expect(screen.getByTestId('fs-save')).toHaveAttribute('title', t.freestyle.saveDisabled);
    act(() => store().loadPair(off(), { ...def(), players: [] }, 'offense'));
    expect(screen.getByTestId('fs-save')).toBeDisabled();
  });

  it('creates 2 plays and 1 matchup tagged freestyle, then opens the matchup', async () => {
    localStorage.setItem(DRAFT_KEY, stored());
    await mount();
    expect(screen.getByTestId('fs-save')).toBeEnabled();
    fireEvent.click(screen.getByTestId('fs-save'));
    const stub = await screen.findByTestId('matchup-stub');
    const plays = await playsRepo.list();
    const matchups = await matchupsRepo.list();
    expect(plays).toHaveLength(2);
    expect(matchups).toHaveLength(1);
    expect(plays.every((p) => p.tags.includes('freestyle'))).toBe(true);
    expect(plays.map((p) => p.side).sort()).toEqual(['defense', 'offense']);
    expect(plays.every((p) => /^Freestyle \d\d\/\d\d \d\d:\d\d · /.test(p.name))).toBe(true);
    expect(plays.some((p) => p.id === 'o1' || p.id === 'd1')).toBe(false);
    const m = matchups[0]!;
    expect(stub.textContent).toBe(m.id);
    expect(m.seed).toBe(1);
    expect(m.offenseFlipped).toBe(false);
    expect(plays.find((p) => p.id === m.offensePlayId)?.side).toBe('offense');
    expect(plays.find((p) => p.id === m.defensePlayId)?.side).toBe('defense');
    // draft is kept
    expect(loadDraft()).not.toBeNull();
  });

  it('shows an inline error when saving fails', async () => {
    localStorage.setItem(DRAFT_KEY, stored());
    await mount();
    vi.spyOn(playsRepo, 'put').mockRejectedValue(new Error('quota'));
    fireEvent.click(screen.getByTestId('fs-save'));
    expect(await screen.findByTestId('fs-save-error')).toHaveTextContent(t.freestyle.saveError);
    expect(screen.queryByTestId('matchup-stub')).toBeNull();
  });
});

describe('T-FS-06 warnings badge and flip', () => {
  it('counts warnings of non-empty sides without blocking Chạy thử', async () => {
    localStorage.setItem(DRAFT_KEY, stored());
    await mount();
    // 2 offense players, 1 defense player on a 5v5 field: too-few-players on each side
    await waitFor(() => expect(screen.getByTestId('fs-warnings')).toHaveTextContent('2'));
    expect(screen.getByTestId('fs-warnings').getAttribute('title')).toContain('Thiếu người');
    expect(screen.getByTestId('fs-run')).toBeEnabled();
  });

  it('flip mirrors the active side and is undoable', async () => {
    const o = makePlay('o1', {
      side: 'offense',
      players: [{ id: 'a', role: 'QB', label: 'Q', start: { x: 3, y: -5 }, actions: [] }],
    });
    localStorage.setItem(DRAFT_KEY, stored({ offense: o }));
    await mount();
    fireEvent.click(screen.getByTestId('fs-flip'));
    expect(store().play?.players[0]?.start.x).toBe(-3);
    expect(store().play).toEqual(flipPlay(o));
    expect(store().companion?.players).toHaveLength(1);
    fireEvent.click(screen.getByTestId('fs-undo'));
    expect(store().play?.players[0]?.start.x).toBe(3);
  });
});

describe('Freestyle ball spot (LOS drag)', () => {
  it('saves and loads the ball spot; a bad value falls back to null', () => {
    saveBallSpot({ x: 0, yardLine: 45 });
    expect(loadBallSpot()).toEqual({ x: 0, yardLine: 45 });
    localStorage.setItem(BALL_KEY, '{"x":0,"yardLine":"far"}');
    expect(loadBallSpot()).toBeNull();
  });

  it('the trial matchup uses the given ball spot', () => {
    const m = trialMatchup(makePlay('o', { side: 'offense' }), makePlay('d', { side: 'defense' }), {
      x: 0,
      yardLine: 45,
    });
    expect(m.ballSpot).toEqual({ x: 0, yardLine: 45 });
  });
});

describe('D-51 loadDraft gives a frozen lane rectangle the live lane zone', () => {
  it("the user's FS / SS board loads with lane zones", () => {
    const rule = (n: 1 | 2, area: object) => [
      {
        id: `r${n}`,
        priority: 0,
        when: { receiver: { kind: 'nth', n }, event: 'entersArea', area },
        then: { type: 'manTrigger' },
      },
    ];
    const rect = (x0: number, x1: number) => ({
      polygon: [
        { x: x0, y: 0 },
        { x: x1, y: 0 },
        { x: x1, y: 10 },
        { x: x0, y: 10 },
      ],
    });
    const board = {
      ...def(),
      players: [
        {
          id: 'cb1',
          role: 'CB',
          label: 'CB1',
          start: { x: -10, y: 7 },
          actions: [],
          matchRules: rule(1, { kind: 'self' }),
        },
        {
          id: 'fs',
          role: 'S',
          label: 'FS',
          start: { x: -2, y: 7 },
          actions: [{ type: 'zone', zone: rect(-6, 0.25), dropPoint: { x: -2.875, y: 5 } }],
          matchRules: rule(2, { kind: 'teammate', slotId: 'cb1' }),
        },
        {
          id: 'cb2',
          role: 'CB',
          label: 'CB2',
          start: { x: 7.5, y: 7 },
          actions: [],
          matchRules: rule(1, { kind: 'self' }),
        },
      ],
    };
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: 1, offense: off(), defense: board, activeSide: 'defense' }),
    );
    const fs = loadDraft()!.defense.players.find((p) => p.id === 'fs')!;
    expect(fs.actions).toEqual([{ type: 'zone', zone: 'lane', dropPoint: { x: -2, y: 7 } }]);
  });
});
