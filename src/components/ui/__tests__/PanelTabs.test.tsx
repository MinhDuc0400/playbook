import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelTabs } from '../PanelTabs';

const tabs = [
  { id: 'a', label: 'A', content: <p>panel A</p> },
  { id: 'b', label: 'B', content: <p>panel B</p> },
];

describe('PanelTabs (D-25)', () => {
  it('stacks every panel in stack mode', () => {
    render(<PanelTabs tabs={tabs} mode="stack" />);
    expect(screen.getByText('panel A')).toBeInTheDocument();
    expect(screen.getByText('panel B')).toBeInTheDocument();
  });

  it('shows one panel at a time in tabs mode', () => {
    render(<PanelTabs tabs={tabs} mode="tabs" />);
    expect(screen.getByText('panel A')).toBeInTheDocument();
    expect(screen.queryByText('panel B')).toBeNull();
    fireEvent.click(screen.getByTestId('panel-tabs-tab-b'));
    expect(screen.getByText('panel B')).toBeInTheDocument();
    expect(screen.getByTestId('panel-tabs-tab-b')).toHaveAttribute('aria-selected', 'true');
  });

  it('defaults to stack without matchMedia (jsdom = desktop)', () => {
    render(<PanelTabs tabs={tabs} />);
    expect(screen.getByTestId('panel-tabs')).toHaveAttribute('data-mode', 'stack');
  });
});
