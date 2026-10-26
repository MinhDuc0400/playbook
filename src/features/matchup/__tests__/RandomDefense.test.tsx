import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playsRepo } from '@/db/repos/plays';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import type { Play } from '@/domain/types';
import { t } from '@/i18n/vi';
import { RandomDefense } from '../RandomDefense';

let all: Play[] = [];
const get = (id: string): Play => all.find((p) => p.id === id)!;

beforeEach(async () => {
  for (const p of await playsRepo.list()) await playsRepo.remove(p.id);
  all = createSamplePlays(1);
  for (const p of all) await playsRepo.put(p);
  // A defense of another format must never be picked.
  const other: Play = { ...get(SEED_IDS.cover2), id: 'def-7v7', name: 'Seven', format: '7v7' };
  await playsRepo.put(other);
});
afterEach(() => vi.restoreAllMocks());

function Harness({
  initial = SEED_IDS.cover1,
  ended = false,
  onPick,
  onHidden,
}: {
  initial?: string;
  ended?: boolean;
  onPick?: (id: string) => void;
  onHidden?: (h: boolean) => void;
}) {
  const [defId, setDefId] = useState(initial);
  const [hidden, setHidden] = useState(false);
  return (
    <RandomDefense
      offense={get(SEED_IDS.mesh)}
      defense={get(defId)}
      hidden={hidden}
      ended={ended}
      onPick={(id) => {
        onPick?.(id);
        setDefId(id);
      }}
      onHiddenChange={(h) => {
        onHidden?.(h);
        setHidden(h);
      }}
    />
  );
}

describe('RandomDefense (FR-RD-01..04)', () => {
  it('FR-RD-01 picks only same-format defenses matching the tag filter, then hides', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onHidden = vi.fn();
    render(<Harness onPick={onPick} onHidden={onHidden} />);
    const tag = (await screen.findByTestId('rd-tag')) as HTMLSelectElement;
    await waitFor(() => expect(tag.options.length).toBeGreaterThan(1));
    await user.selectOptions(tag, 'cov:cover-3');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await user.click(screen.getByTestId('rd-random'));
    expect(onPick).toHaveBeenCalledWith(SEED_IDS.cover3);
    expect(onHidden).toHaveBeenLastCalledWith(true);

    await user.selectOptions(tag, '');
    for (const r of [0, 0.5, 0.99]) {
      onPick.mockClear();
      vi.spyOn(Math, 'random').mockReturnValue(r);
      await user.click(screen.getByTestId('rd-random'));
      const id = onPick.mock.calls[0]![0] as string;
      expect([SEED_IDS.cover1, SEED_IDS.cover2, SEED_IDS.cover3]).toContain(id);
    }
  });

  it('never repeats the current defense when others exist', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness initial={SEED_IDS.cover2} onPick={onPick} />);
    await waitFor(() =>
      expect((screen.getByTestId('rd-tag') as HTMLSelectElement).options.length).toBeGreaterThan(1),
    );
    await user.selectOptions(screen.getByTestId('rd-tag'), 'cov:cover-2');
    // only cover2 matches the filter: falls back to it
    await user.click(screen.getByTestId('rd-random'));
    expect(onPick).toHaveBeenCalledWith(SEED_IDS.cover2);
    onPick.mockClear();
    await user.selectOptions(screen.getByTestId('rd-tag'), '');
    for (const r of [0, 0.4, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      await user.click(screen.getByTestId('rd-random'));
    }
    expect(onPick.mock.calls.every((c) => c[0] !== 'def-7v7')).toBe(true);
  });

  it('FR-RD-02/03 hides the name, lists cov guesses, reveals with a wrong answer and counts', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() =>
      expect((screen.getByTestId('rd-tag') as HTMLSelectElement).options.length).toBeGreaterThan(1),
    );
    await user.selectOptions(screen.getByTestId('rd-tag'), 'cov:cover-3');
    await user.click(screen.getByTestId('rd-random'));
    expect(screen.getByTestId('rd-name')).toHaveTextContent(t.randomDef.hiddenName);
    for (const tg of ['cov:cover-0', 'cov:cover-1', 'cov:cover-2', 'cov:cover-3', 'cov:man', 'cov:zone']) {
      expect(screen.getByTestId(`rd-guess-${tg}`)).toBeInTheDocument();
    }
    await user.click(screen.getByTestId('rd-guess-cov:cover-2'));
    await user.click(screen.getByTestId('rd-reveal'));
    expect(screen.getByTestId('rd-name')).toHaveTextContent(get(SEED_IDS.cover3).name);
    expect(screen.getByTestId('rd-result')).toHaveTextContent(t.randomDef.wrong);
    expect(screen.getByTestId('rd-result')).toHaveTextContent('Cover 3');
    expect(screen.queryByTestId('rd-guess-cov:man')).toBeNull();
    expect(screen.getByTestId('rd-score')).toHaveTextContent('0 / 1');

    await user.click(screen.getByTestId('rd-random'));
    await user.click(screen.getByTestId('rd-guess-cov:cover-3'));
    await user.click(screen.getByTestId('rd-reveal'));
    expect(screen.getByTestId('rd-result')).toHaveTextContent(t.randomDef.correct);
    expect(screen.getByTestId('rd-score')).toHaveTextContent('1 / 2');
  });

  it('FR-RD-03 reveals automatically when the animation ends', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness ended={false} />);
    await waitFor(() =>
      expect((screen.getByTestId('rd-tag') as HTMLSelectElement).options.length).toBeGreaterThan(1),
    );
    await user.click(screen.getByTestId('rd-random'));
    await user.click(screen.getByTestId('rd-guess-cov:man'));
    expect(screen.getByTestId('rd-name')).toHaveTextContent(t.randomDef.hiddenName);
    rerender(<Harness ended />);
    await waitFor(() => expect(screen.queryByTestId('rd-reveal')).toBeNull());
    expect(within(screen.getByTestId('random-defense')).getByTestId('rd-result')).toBeInTheDocument();
  });
});
