import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Playback } from '@/components/field/usePlayback';
import { useMatchupShortcuts } from '../useMatchupShortcuts';

function makePlayback(): Playback {
  return {
    t: 0,
    playing: false,
    speed: 1,
    loop: false,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    seek: vi.fn(),
    setSpeed: vi.fn(),
    slower: vi.fn(),
    faster: vi.fn(),
    setLoop: vi.fn(),
    stepToMark: vi.fn(),
  };
}

function Harness({ pb, marks }: { pb: Playback; marks: number[] }): JSX.Element {
  useMatchupShortcuts(pb, marks);
  return (
    <div>
      <input data-testid="inp" />
      <textarea data-testid="ta" />
      <select data-testid="sel" />
    </div>
  );
}

describe('useMatchupShortcuts (FR-MU-03, §12.3)', () => {
  it('Space toggles (default prevented), arrows step to markers, brackets change speed', () => {
    const pb = makePlayback();
    render(<Harness pb={pb} marks={[0.5, 1]} />);
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    window.dispatchEvent(space);
    expect(pb.toggle).toHaveBeenCalledTimes(1);
    expect(space.defaultPrevented).toBe(true);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(pb.stepToMark).toHaveBeenLastCalledWith(1, [0.5, 1]);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(pb.stepToMark).toHaveBeenLastCalledWith(-1, [0.5, 1]);
    fireEvent.keyDown(window, { key: '[' });
    expect(pb.slower).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: ']' });
    expect(pb.faster).toHaveBeenCalledTimes(1);
  });

  it('is ignored inside inputs, textareas and selects', () => {
    const pb = makePlayback();
    const { getByTestId } = render(<Harness pb={pb} marks={[1]} />);
    for (const id of ['inp', 'ta', 'sel']) {
      for (const key of [' ', 'ArrowRight', 'ArrowLeft', '[', ']'])
        fireEvent.keyDown(getByTestId(id), { key });
    }
    expect(pb.toggle).not.toHaveBeenCalled();
    expect(pb.stepToMark).not.toHaveBeenCalled();
    expect(pb.slower).not.toHaveBeenCalled();
    expect(pb.faster).not.toHaveBeenCalled();
  });

  it('uses the latest playback and markers after re-render, and unbinds on unmount', () => {
    const a = makePlayback();
    const b = makePlayback();
    const { rerender, unmount } = render(<Harness pb={a} marks={[1]} />);
    rerender(<Harness pb={b} marks={[2]} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(b.stepToMark).toHaveBeenCalledWith(1, [2]);
    expect(a.stepToMark).not.toHaveBeenCalled();
    unmount();
    fireEvent.keyDown(window, { key: ' ' });
    expect(b.toggle).not.toHaveBeenCalled();
  });
});
