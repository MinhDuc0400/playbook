import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/vi';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom({ explode }: { explode: boolean }): JSX.Element {
  if (explode) throw new Error('broken play data');
  return <p>healthy screen</p>;
}

afterEach(cleanup);

describe('NFR-REL-04 ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an alert for a throwing child while siblings outside still render', () => {
    render(
      <div>
        <p>sibling</p>
        <ErrorBoundary resetKey="/a">
          <Boom explode />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('sibling')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(t.common.screenError);
    expect(alert).toHaveTextContent('broken play data');
    const link = screen.getByRole('link', { name: t.common.backToPlaybook });
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary resetKey="/a">
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('recovers when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(
      <ErrorBoundary resetKey="/b">
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('healthy screen')).toBeInTheDocument();
  });

  it('stays in the error state while resetKey is unchanged', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Boom explode />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary resetKey="/a">
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
