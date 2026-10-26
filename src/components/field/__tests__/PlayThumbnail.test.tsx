import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSamplePlays, SEED_IDS } from '@/db/seed/samplePlays';
import { createDefaultFields } from '@/domain/field';
import { PlayThumbnail } from '../PlayThumbnail';

const field = createDefaultFields()['5v5'];
const plays = createSamplePlays(1000);
const get = (id: string) => plays.find((p) => p.id === id)!;

describe('PlayThumbnail (FR-PB-01)', () => {
  it('offense: tokens and route paths, no pointer events', () => {
    const play = get(SEED_IDS.flood);
    const { container } = render(<PlayThumbnail play={play} field={field} />);
    const root = screen.getByTestId(`play-thumb-${play.id}`);
    expect(root).toHaveStyle({ pointerEvents: 'none' });
    expect(container.querySelectorAll('[data-kind="player"]')).toHaveLength(play.players.length);
    expect(container.querySelectorAll('[data-variant="route"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-zone-kind]')).toBeNull();
  });

  it('Cover 1: man lines, rush arrow, no routes', () => {
    const play = get(SEED_IDS.cover1);
    const { container } = render(<PlayThumbnail play={play} field={field} width={120} height={80} />);
    expect(container.querySelectorAll('[data-variant="man"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-variant="rush"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-variant="route"]')).toBeNull();
  });

  it('Cover 3: zones are drawn', () => {
    const { container } = render(<PlayThumbnail play={get(SEED_IDS.cover3)} field={field} />);
    expect(container.querySelectorAll('[data-zone-kind]').length).toBeGreaterThan(0);
  });

  it('flipped mirrors token x positions', () => {
    const play = get(SEED_IDS.flood);
    const a = render(<PlayThumbnail play={play} field={field} />);
    const b = render(<PlayThumbnail play={play} field={field} flipped />);
    const xs = (c: HTMLElement) =>
      [...c.querySelectorAll('[data-kind="player"] circle[data-part="body"]')].map((e) =>
        Number(e.getAttribute('cx')),
      );
    const xa = xs(a.container);
    const xb = xs(b.container);
    expect(xa.length).toBeGreaterThan(0);
    expect(xa.some((x, i) => Math.abs(x - (xb[i] ?? x)) > 1)).toBe(true);
  });
});
