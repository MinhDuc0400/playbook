import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { t } from '@/i18n/vi';
import { RunManyPanel } from '../RunManyPanel';

const input = makeInput(floodPlay(), cover3Play());
const labels = Object.fromEntries(input.offense.players.map((p) => [p.id, p.label]));

afterEach(cleanup);

describe('RunManyPanel (FR-MU-13)', () => {
  it('runs 50, shows progress then results with a target distribution', async () => {
    const user = userEvent.setup();
    render(<RunManyPanel input={input} labels={labels} />);
    expect(screen.queryByTestId('run-many-result')).toBeNull();
    await user.click(screen.getByTestId('run-many'));
    expect(screen.getByTestId('run-many-progress')).toHaveTextContent(/\d+ \/ 50/);
    expect(await screen.findByTestId('run-many-result', {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.queryByTestId('run-many-progress')).toBeNull();
    expect(screen.getByTestId('run-many-pcomplete')).toHaveTextContent('%');
    expect(screen.getByTestId('run-many-psack')).toBeInTheDocument();
    expect(screen.getByTestId('run-many-pint')).toBeInTheDocument();
    const bars = screen.getAllByTestId(/^run-many-target-/);
    expect(bars.length).toBeGreaterThan(0);
    const sum = bars.reduce((a, b) => a + Number(b.getAttribute('data-fraction')), 0);
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeLessThanOrEqual(1.0001);
  }, 20000);

  it('cancel stops the run and shows no result', async () => {
    const user = userEvent.setup();
    render(<RunManyPanel input={input} labels={labels} />);
    await user.click(screen.getByTestId('run-many'));
    await user.click(screen.getByTestId('run-many-cancel'));
    await waitFor(() =>
      expect(screen.getByTestId('run-many-message')).toHaveTextContent(t.matchup.runMany.cancelled),
    );
    expect(screen.queryByTestId('run-many-progress')).toBeNull();
    expect(screen.queryByTestId('run-many-result')).toBeNull();
    expect(screen.getByTestId('run-many')).toBeEnabled();
  });

  it('marks results stale when the input changes, and a re-run replaces them', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RunManyPanel input={input} labels={labels} />);
    await user.click(screen.getByTestId('run-many'));
    await screen.findByTestId('run-many-result', {}, { timeout: 15000 });
    expect(screen.queryByTestId('run-many-stale')).toBeNull();
    rerender(<RunManyPanel input={{ ...input, seed: input.seed + 1 }} labels={labels} />);
    expect(screen.getByTestId('run-many-stale')).toBeInTheDocument();
    await user.click(screen.getByTestId('run-many'));
    await waitFor(() => expect(screen.queryByTestId('run-many-stale')).toBeNull(), { timeout: 15000 });
    expect(screen.getByTestId('run-many-result')).toBeInTheDocument();
  }, 40000);
});
