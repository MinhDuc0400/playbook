import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/vi';
import type { Outcome, Play, SimResult } from '@/domain/types';
import { mkPlay } from '@/features/editor/__tests__/fixtures';
import { ResultPanel } from '../ResultPanel';

const offense = mkPlay([
  { id: 'q', role: 'QB', label: 'Q', start: { x: 0, y: -5 }, actions: [] },
  { id: 'x', role: 'WR', label: 'X', start: { x: -8, y: 0 }, actions: [] },
  { id: 'z', role: 'WR', label: 'Z', start: { x: 8, y: 0 }, actions: [] },
  { id: 'y', role: 'TE', label: 'Y', start: { x: 4, y: 0 }, actions: [] },
]) as Play;

function mkResult(outcome: Outcome, over: Partial<SimResult['metrics']> = {}): SimResult {
  const ball = { pos: { x: 0, y: 0 }, z: 0, state: 'held' } as unknown as SimResult['frames'][0]['ball'];
  return {
    frames: [
      { t: 0, players: {}, ball },
      { t: 4, players: {}, ball },
    ],
    events: [],
    outcome,
    warnings: [],
    metrics: {
      separation: {},
      separationAtThrow: { x: 0.5, z: 1.8, y: 3.0 },
      timeToThrow: 2.345,
      openWindows: {
        x: [[1, 2]],
        z: [
          [0, 1],
          [2, 4],
        ],
        y: [],
      },
      ...over,
    },
  };
}

describe('FR-MU-07 ResultPanel', () => {
  it('complete shows label, target, yards, ttt', () => {
    render(
      <ResultPanel
        result={mkResult({ kind: 'complete', targetId: 'z', yards: 12.34, t: 3 })}
        offense={offense}
        t={0}
      />,
    );
    expect(screen.getByTestId('result-outcome').textContent).toBe(t.result.outcome.complete);
    expect(screen.getByTestId('result-target').textContent).toBe('Z');
    expect(screen.getByTestId('result-yards').textContent).toBe('12.3');
    expect(screen.getByTestId('result-ttt').textContent).toContain('2.35');
  });

  it('sack shows no target and ttt dash', () => {
    render(
      <ResultPanel
        result={mkResult({ kind: 'sack', t: 3 }, { timeToThrow: undefined })}
        offense={offense}
        t={0}
      />,
    );
    expect(screen.queryByTestId('result-target')).toBeNull();
    expect(screen.queryByTestId('result-yards')).toBeNull();
    expect(screen.getByTestId('result-ttt').textContent).toBe('—');
  });

  it('renders a label for each kind', () => {
    const outcomes: Outcome[] = [
      { kind: 'incomplete', targetId: 'x', t: 1 },
      { kind: 'deflected', targetId: 'x', t: 1 },
      { kind: 'intercepted', targetId: 'x', t: 1 },
      { kind: 'throwaway', t: 1 },
      { kind: 'timeout', t: 7 },
    ];
    for (const o of outcomes) {
      const { unmount } = render(<ResultPanel result={mkResult(o)} offense={offense} t={0} />);
      expect(screen.getByTestId('result-outcome').textContent).toBe(t.result.outcome[o.kind]);
      unmount();
    }
  });

  it('rows exclude QB; separation colours and missing dash', () => {
    render(
      <ResultPanel
        result={mkResult(
          { kind: 'incomplete', targetId: 'x', t: 1 },
          { separationAtThrow: { x: 0.5, z: 1.8 } },
        )}
        offense={offense}
        t={0}
      />,
    );
    expect(screen.queryByTestId('result-row-Q')).toBeNull();
    const sep = (l: string) => within(screen.getByTestId(`result-row-${l}`)).getByTestId('result-sep');
    expect(sep('X').className).toContain('red');
    expect(sep('Z').className).toContain('amber');
    expect(sep('Y').textContent).toBe('—');
  });

  it('green for open separation', () => {
    render(
      <ResultPanel result={mkResult({ kind: 'incomplete', targetId: 'x', t: 1 })} offense={offense} t={0} />,
    );
    const y = within(screen.getByTestId('result-row-Y')).getByTestId('result-sep');
    expect(y.className).toContain('green');
    expect(y.textContent).toBe('3.0');
  });

  it('open-window segments proportional; playhead moves', () => {
    const r = mkResult({ kind: 'incomplete', targetId: 'x', t: 1 });
    const { rerender } = render(<ResultPanel result={r} offense={offense} t={1} />);
    const zRow = within(screen.getByTestId('result-row-Z'));
    const segs = zRow.getAllByTestId('open-window');
    expect(segs).toHaveLength(2);
    expect(segs[1]!.style.left).toBe('50%');
    expect(segs[1]!.style.width).toBe('50%');
    expect(within(screen.getByTestId('result-row-Y')).queryAllByTestId('open-window')).toHaveLength(0);
    expect(zRow.getByTestId('playhead').style.left).toBe('25%');
    rerender(<ResultPanel result={r} offense={offense} t={3} />);
    expect(within(screen.getByTestId('result-row-Z')).getByTestId('playhead').style.left).toBe('75%');
  });
});
