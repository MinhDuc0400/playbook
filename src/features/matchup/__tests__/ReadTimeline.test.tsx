import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/domain/defaults';
import type { Frame, Play, SimResult } from '@/domain/types';
import { mkPlay } from '@/features/editor/__tests__/fixtures';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { frameAt } from '@/engine/frames';
import { simulate } from '@/engine/simulate';
import { ReadTimeline, decisionText } from '../ReadTimeline';

const offense = {
  ...mkPlay([
    { id: 'q', role: 'QB', label: 'Q', start: { x: 0, y: -5 }, actions: [] },
    { id: 'x', role: 'WR', label: 'X', start: { x: -8, y: 0 }, actions: [] },
    { id: 'z', role: 'WR', label: 'Z', start: { x: 8, y: 0 }, actions: [] },
    { id: 'y', role: 'TE', label: 'Y', start: { x: 4, y: 0 }, actions: [] },
  ]),
  readPlan: { mode: 'progression', minScore: { y: 70 } },
} as Play;

function mk(decision: NonNullable<SimResult['metrics']['reads']>['decision']): SimResult {
  const ball = { pos: { x: 0, y: 0 }, z: 0, state: 'held' } as unknown as Frame['ball'];
  const frames: Frame[] = [0, 1, 2, 3, 4].map((t) => ({
    t,
    players: {},
    ball,
    qb: { readId: t < 2 ? 'x' : 'z', scores: { x: 10 * t, z: 20 * t, y: 5 } },
  }));
  return {
    frames,
    events: [],
    outcome: { kind: 'timeout', t: 4 },
    warnings: [],
    metrics: {
      separation: {},
      openWindows: { x: [[1, 2]], z: [[2, 4]], y: [] },
      reads: {
        mode: 'progression',
        windows: [
          { id: 'x', index: 0, from: 1, to: 2, auto: true },
          { id: 'z', index: 1, from: 2, to: 4, auto: false },
        ],
        decision,
      },
    },
  };
}

const read = { kind: 'read', t: 3, targetId: 'z', score: 71.6, readIndex: 1 } as const;

describe('D-22 ReadTimeline', () => {
  it('draws window bands, open segments in read order, highlights the current read', () => {
    const { rerender } = render(<ReadTimeline result={mk(read)} offense={offense} t={1} />);
    const rows = screen.getAllByTestId(/^read-tl-row-/).map((r) => r.getAttribute('data-testid'));
    expect(rows).toEqual(['read-tl-row-X', 'read-tl-row-Z', 'read-tl-row-Y']);
    const w = screen.getByTestId('read-window-Z');
    expect(w.style.left).toBe('50%');
    expect(w.style.width).toBe('50%');
    expect(w.dataset.auto).toBe('false');
    expect(screen.getByTestId('read-window-X').dataset.auto).toBe('true');
    expect(screen.getByTestId('read-window-X').title).toContain('1.00 s');
    expect(screen.queryByTestId('read-window-Y')).toBeNull();
    const open = screen.getByTestId('open-window-Z');
    expect(open.style.left).toBe('50%');
    expect(open.title).toBe('mở 2.00–4.00 s (2.00 s)');
    expect(screen.queryByTestId('open-window-Y')).toBeNull();
    expect(screen.getByTestId('read-tl-row-X').dataset.current).toBe('true');
    expect(screen.getByTestId('read-tl-row-Z').dataset.current).toBeUndefined();
    rerender(<ReadTimeline result={mk(read)} offense={offense} t={3} />);
    expect(screen.getByTestId('read-tl-row-Z').dataset.current).toBe('true');
    expect(screen.getByTestId('read-tl-row-X').dataset.current).toBeUndefined();
  });

  it('shows the decision text per kind', () => {
    const cases: [Parameters<typeof mk>[0], string][] = [
      [read, 'Ném #2 (Z) · điểm 72'],
      [{ kind: 'checkdown', t: 3, targetId: 'y', readIndex: null }, 'Check-down (Y)'],
      [{ kind: 'forced', t: 3, targetId: 'z', readIndex: null }, 'Bị ép → Z'],
      [{ kind: 'throwaway', t: 3, readIndex: null }, 'Ném bỏ'],
      [{ kind: 'none', t: 3, readIndex: null }, 'Không ném'],
    ];
    for (const [d, text] of cases) {
      const { unmount } = render(<ReadTimeline result={mk(d)} offense={offense} t={0} />);
      expect(screen.getByTestId('read-decision')).toHaveTextContent(text);
      unmount();
    }
    expect(decisionText(mk(read).metrics.reads!, (id) => id.toUpperCase())).toBe('Ném #2 (Z) · điểm 72');
  });

  it('score chart: one polyline per receiver, threshold lines, current values at t', () => {
    const result = mk(read);
    render(<ReadTimeline result={result} offense={offense} t={2.5} tuning={DEFAULT_TUNING} />);
    const chart = screen.getByTestId('read-scores');
    expect(chart.querySelectorAll('polyline')).toHaveLength(3);
    expect(screen.getByTestId('read-threshold-55')).toBeInTheDocument();
    expect(screen.getByTestId('read-threshold-70')).toBeInTheDocument();
    expect(screen.getByText('ngưỡng 55')).toBeInTheDocument();
    const f = frameAt(result.frames, 2.5)!;
    for (const [id, label] of [
      ['x', 'X'],
      ['z', 'Z'],
      ['y', 'Y'],
    ] as const) {
      expect(screen.getByTestId(`read-score-${label}`).textContent).toBe(
        String(Math.round(f.qb!.scores[id]!)),
      );
    }
    expect(screen.getByTestId('read-decision-dot')).toBeInTheDocument();
  });

  it('collapse toggle hides the body', () => {
    render(<ReadTimeline result={mk(read)} offense={offense} t={0} />);
    expect(screen.getByTestId('read-scores')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('read-timeline-toggle'));
    expect(screen.queryByTestId('read-scores')).toBeNull();
    fireEvent.click(screen.getByTestId('read-timeline-toggle'));
    expect(screen.getByTestId('read-scores')).toBeInTheDocument();
  });

  it('renders nothing without reads', () => {
    const r = mk(read);
    delete r.metrics.reads;
    const { container } = render(<ReadTimeline result={r} offense={offense} t={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('matches a real simulate() run', () => {
    const play = floodPlay();
    const result = simulate(makeInput(play, cover3Play()));
    render(<ReadTimeline result={result} offense={play} t={result.frames[0]!.t} />);
    const reads = result.metrics.reads!;
    for (const win of reads.windows) {
      const label = play.players.find((p) => p.id === win.id)!.label;
      expect(
        within(screen.getByTestId(`read-tl-row-${label}`)).getByTestId(`read-window-${label}`),
      ).toBeInTheDocument();
    }
    expect(screen.getByTestId('read-decision')).toBeInTheDocument();
    expect(screen.getByTestId('read-scores').querySelectorAll('polyline')).toHaveLength(4);
  });
});
