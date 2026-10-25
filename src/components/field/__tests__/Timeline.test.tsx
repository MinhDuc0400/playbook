import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/vi';
import { Timeline, type TimelineMarker } from '../Timeline';
import { PLAYBACK_SPEEDS, type Playback } from '../usePlayback';

function makePlayback(over: Partial<Playback> = {}): Playback {
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
    ...over,
  };
}

const markers: TimelineMarker[] = [
  { t: -1, type: 'snap' },
  { t: 1, type: 'break', label: 'X break' },
  { t: 3, type: 'throw' },
];

describe('Timeline (FR-MU-03/04)', () => {
  it('play button calls toggle and its aria-label follows playing', () => {
    const pb = makePlayback();
    const { rerender } = render(<Timeline playback={pb} duration={4} />);
    const btn = screen.getByTestId('btn-play');
    expect(btn).toHaveAttribute('aria-label', t.playback.play);
    fireEvent.click(btn);
    expect(pb.toggle).toHaveBeenCalledTimes(1);
    rerender(<Timeline playback={makePlayback({ playing: true })} duration={4} />);
    expect(screen.getByTestId('btn-play')).toHaveAttribute('aria-label', t.playback.pause);
  });

  it('time label is t.toFixed(1) + " s"', () => {
    const { rerender } = render(<Timeline playback={makePlayback({ t: 1.26 })} duration={4} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('1.3 s');
    rerender(<Timeline playback={makePlayback({ t: -0.0001 })} duration={4} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent(/^0\.0 s$/);
    rerender(<Timeline playback={makePlayback({ t: -1.5 })} duration={4} minT={-2} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('-1.5 s');
  });

  it('scrubber exposes min/max/step/value and calls seek on change', () => {
    const pb = makePlayback({ t: 1 });
    render(<Timeline playback={pb} duration={4} minT={-2} />);
    const s = screen.getByTestId('timeline-scrubber') as HTMLInputElement;
    expect(s.type).toBe('range');
    expect(s).toHaveAttribute('min', '-2');
    expect(s).toHaveAttribute('max', '4');
    expect(Number(s.step)).toBeCloseTo(1 / 30, 6);
    expect(s.value).toBe('1');
    expect(s).toHaveAttribute('aria-label', t.playback.scrubber);
    fireEvent.change(s, { target: { value: '2.5' } });
    expect(pb.seek).toHaveBeenCalledWith(2.5);
  });

  it('markers carry data-type, title and positions proportional to t', () => {
    render(<Timeline playback={makePlayback()} duration={4} minT={-1} markers={markers} />);
    const els = screen.getAllByTestId('timeline-marker');
    expect(els.map((e) => e.getAttribute('data-type'))).toEqual(['snap', 'break', 'throw']);
    expect(els.map((e) => e.getAttribute('title'))).toEqual(['snap', 'X break', 'throw']);
    // span = 5: (-1 + 1)/5 = 0%, (1 + 1)/5 = 40%, (3 + 1)/5 = 80%
    expect(els[0]?.style.left).toBe('0%');
    expect(els[1]?.style.left).toBe('40%');
    expect(els[2]?.style.left).toBe('80%');
  });

  it('speed buttons set speed and aria-pressed marks the active one', () => {
    const pb = makePlayback({ speed: 0.5 });
    render(<Timeline playback={pb} duration={4} />);
    for (const s of PLAYBACK_SPEEDS) {
      expect(screen.getByTestId(`btn-speed-${s}`)).toHaveAttribute('aria-pressed', String(s === 0.5));
    }
    fireEvent.click(screen.getByTestId('btn-speed-2'));
    expect(pb.setSpeed).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByTestId('btn-speed-0.25'));
    expect(pb.setSpeed).toHaveBeenCalledWith(0.25);
  });

  it('prev / next event buttons call stepToMark with the marker times', () => {
    const pb = makePlayback();
    render(<Timeline playback={pb} duration={4} minT={-1} markers={markers} />);
    fireEvent.click(screen.getByTestId('btn-prev-event'));
    expect(pb.stepToMark).toHaveBeenLastCalledWith(-1, [-1, 1, 3]);
    fireEvent.click(screen.getByTestId('btn-next-event'));
    expect(pb.stepToMark).toHaveBeenLastCalledWith(1, [-1, 1, 3]);
    expect(screen.getByTestId('btn-prev-event')).toHaveAttribute('aria-label', t.playback.prevEvent);
    expect(screen.getByTestId('btn-next-event')).toHaveAttribute('aria-label', t.playback.nextEvent);
  });

  it('compact hides speed and event buttons but keeps play, scrubber and time', () => {
    render(<Timeline playback={makePlayback()} duration={4} compact />);
    expect(screen.queryByTestId('btn-prev-event')).toBeNull();
    expect(screen.queryByTestId('btn-next-event')).toBeNull();
    for (const s of PLAYBACK_SPEEDS) expect(screen.queryByTestId(`btn-speed-${s}`)).toBeNull();
    expect(screen.getByTestId('btn-play')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-scrubber')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-time')).toBeInTheDocument();
  });

  it('handles a zero-length range without NaN positions', () => {
    render(<Timeline playback={makePlayback()} duration={0} markers={[{ t: 0, type: 'snap' }]} />);
    expect(screen.getByTestId('timeline-marker').style.left).toBe('0%');
  });
});
