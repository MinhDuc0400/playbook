import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n/vi';
import { useEditorStore } from '@/store/editorStore';
import { Toolbar } from '../Toolbar';
import { mkPlay, offenseFixture } from './fixtures';

const store = () => useEditorStore.getState();

beforeEach(() => {
  store().load(offenseFixture());
  store().setTool('select');
});
afterEach(cleanup);

describe('Toolbar (NFR-UX-03)', () => {
  it('shows the offense tools with aria-label, shortcut in the title and aria-pressed', () => {
    render(<Toolbar />);
    expect(screen.getByRole('toolbar', { name: t.tools.toolbar })).toBeInTheDocument();
    const select = screen.getByRole('button', { name: t.tools.select });
    const place = screen.getByRole('button', { name: t.tools.place });
    const route = screen.getByRole('button', { name: t.tools.route });
    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(place).toHaveAttribute('aria-pressed', 'false');
    expect(route).toHaveAttribute('aria-pressed', 'false');
    expect(select).toHaveAttribute('title', expect.stringContaining('V'));
    expect(place).toHaveAttribute('title', expect.stringContaining('P'));
    expect(route).toHaveAttribute('title', expect.stringContaining('R'));
    expect(screen.getByTestId('tool-route')).toBe(route);
  });

  it('clicking a tool sets it and updates aria-pressed', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByTestId('tool-route'));
    expect(store().tool).toBe('route');
    expect(screen.getByTestId('tool-route')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'false');
  });

  it('follows the active tool when it changes elsewhere', () => {
    render(<Toolbar />);
    act(() => store().setTool('place'));
    expect(screen.getByTestId('tool-place')).toHaveAttribute('aria-pressed', 'true');
  });

  it('defense plays offer select and place only', () => {
    store().load(mkPlay([], { side: 'defense' }));
    render(<Toolbar />);
    expect(screen.getByTestId('tool-select')).toBeInTheDocument();
    expect(screen.getByTestId('tool-place')).toBeInTheDocument();
    expect(screen.queryByTestId('tool-route')).toBeNull();
  });
});
