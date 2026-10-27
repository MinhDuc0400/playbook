import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Play, SimResult } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { cover3Play, floodPlay, makeInput, makePlay, qbSlot, wrSlot } from '@/engine/__tests__/fixtures';
import { OpenWindows } from '../OpenWindows';

const offense: Play = makePlay(
  'offense',
  [qbSlot(), wrSlot('a', 'A', -6, null), wrSlot('b', 'B', 6, null), wrSlot('c', 'C', 0, null)],
  ['b', 'a'],
);

function fake(over: Partial<SimResult> = {}, windows: SimResult['metrics']['openWindows'] = {}): SimResult {
  return {
    frames: [0, 1, 2, 3, 4].map((t) => ({ t, players: {} })) as unknown as SimResult['frames'],
    events: [{ t: 2, type: 'throw' }],
    outcome: { kind: 'complete', targetId: 'b', yards: 5, t: 3 },
    metrics: { separation: {}, openWindows: windows },
    warnings: [],
    ...over,
  };
}

describe('OpenWindows', () => {
  const windows = {
    a: [[1, 2]] as [number, number][],
    b: [
      [0, 1],
      [2, 3.5],
    ] as [number, number][],
  };

  it('positions segments proportionally, totals and tooltips', () => {
    render(<OpenWindows result={fake({}, windows)} offense={offense} t={1} />);
    const segs = screen.getAllByTestId('ow-open-B');
    expect(segs[0]).toHaveStyle({ left: '0%', width: '25%' });
    expect(segs[1]).toHaveStyle({ left: '50%', width: '37.5%' });
    expect(segs[1]).toHaveAttribute('title', 'mở 2.00–3.50 s (1.50 s)');
    expect(screen.getByTestId('ow-total-B')).toHaveTextContent('2.50 s');
    expect(screen.getByTestId('ow-total-A')).toHaveTextContent('1.00 s');
    expect(screen.getByTestId('ow-total-C')).toHaveTextContent('0.00 s');
  });

  it('summary names the receiver with the largest total; nobody open message', () => {
    const { rerender } = render(<OpenWindows result={fake({}, windows)} offense={offense} t={0} />);
    expect(screen.getByTestId('ow-summary')).toHaveTextContent('B mở lâu nhất: 2.00–3.50 s (1.50 s)');
    rerender(<OpenWindows result={fake()} offense={offense} t={0} />);
    expect(screen.getByTestId('ow-summary')).toHaveTextContent('Không receiver nào mở ≥ 2.5 yd');
  });

  it('playhead follows t; throw marker; outcome only on target', () => {
    const { rerender } = render(<OpenWindows result={fake({}, windows)} offense={offense} t={1} />);
    expect(screen.getAllByTestId('ow-playhead')[0]).toHaveStyle({ left: '25%' });
    rerender(<OpenWindows result={fake({}, windows)} offense={offense} t={3} />);
    expect(screen.getAllByTestId('ow-playhead')[0]).toHaveStyle({ left: '75%' });
    expect(screen.getAllByTestId('ow-throw')[0]).toHaveStyle({ left: '50%' });
    const out = screen.getAllByTestId('ow-outcome');
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveTextContent('✔');
    expect(within(screen.getByTestId('ow-row-B')).getByTestId('ow-outcome')).toBe(out[0]);
    rerender(
      <OpenWindows
        result={fake({ outcome: { kind: 'incomplete', targetId: 'a', t: 3 }, events: [] }, windows)}
        offense={offense}
        t={3}
      />,
    );
    expect(screen.queryByTestId('ow-throw')).toBeNull();
    const bad = within(screen.getByTestId('ow-row-A')).getByTestId('ow-outcome');
    expect(bad).toHaveTextContent('✖');
    expect(bad).toHaveAttribute('data-success', 'false');
  });

  it('orders by progression then x ascending, with #n badges', () => {
    render(<OpenWindows result={fake()} offense={offense} t={0} />);
    const ids = screen.getAllByTestId(/^ow-row-/).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['ow-row-B', 'ow-row-A', 'ow-row-C']);
    expect(screen.getByTestId('ow-read-B')).toHaveTextContent('#1');
    expect(screen.getByTestId('ow-read-A')).toHaveTextContent('#2');
    expect(screen.queryByTestId('ow-read-C')).toBeNull();
  });

  it('large size uses bigger classes', () => {
    const { rerender } = render(<OpenWindows result={fake()} offense={offense} t={0} />);
    expect(screen.getByTestId('ow-track-A').className).toContain('h-3');
    rerender(<OpenWindows result={fake()} offense={offense} t={0} size="large" />);
    expect(screen.getByTestId('ow-track-A').className).toContain('h-5');
    expect(screen.getByTestId('open-windows').className).toContain('text-base');
    expect(screen.getByTestId('ow-row-A').firstElementChild!.className).toContain('w-16');
  });

  it('matches engine data on a real simulate() run', () => {
    const off = floodPlay();
    const result = simulate(makeInput(off, cover3Play()));
    render(<OpenWindows result={result} offense={off} t={0} />);
    for (const p of off.players.filter((q) => q.role !== 'QB')) {
      const sum = (result.metrics.openWindows[p.id] ?? []).reduce((a, [x, y]) => a + (y - x), 0);
      expect(screen.getByTestId(`ow-total-${p.label}`)).toHaveTextContent(`${sum.toFixed(2)} s`);
      expect(screen.queryAllByTestId(`ow-open-${p.label}`)).toHaveLength(
        (result.metrics.openWindows[p.id] ?? []).length,
      );
    }
    const ids = screen.getAllByTestId(/^ow-row-/).map((e) => e.getAttribute('data-testid'));
    expect(ids.slice(0, 4)).toEqual(['ow-row-Y', 'ow-row-H', 'ow-row-Z', 'ow-row-C']);
  });
});
