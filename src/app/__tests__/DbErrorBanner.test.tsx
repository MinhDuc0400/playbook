import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbErrorInfo } from '@/db/errors';
import { t } from '@/i18n/vi';

let listener: ((i: DbErrorInfo) => void) | null = null;
vi.mock('@/db/errors', () => ({
  onDbError: vi.fn((l: (i: DbErrorInfo) => void) => {
    listener = l;
    return () => {
      listener = null;
    };
  }),
}));

import { DbErrorBanner } from '../DbErrorBanner';

afterEach(cleanup);

describe('NFR-REL-02 DbErrorBanner', () => {
  beforeEach(() => {
    listener = null;
  });

  it('renders nothing until an error is reported', () => {
    render(
      <MemoryRouter>
        <DbErrorBanner />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('db-error-banner')).toBeNull();
  });

  it('shows the quota message and an export link, and can be dismissed', async () => {
    render(
      <MemoryRouter>
        <DbErrorBanner />
      </MemoryRouter>,
    );
    act(() => listener?.({ kind: 'quota', message: 'QuotaExceededError', at: 1 }));
    const banner = screen.getByTestId('db-error-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(t.common.dbError.quota);
    expect(screen.getByRole('link', { name: t.common.dbError.exportLink })).toHaveAttribute(
      'href',
      '/settings',
    );
    await userEvent.click(screen.getByRole('button', { name: t.common.dbError.dismiss }));
    expect(screen.queryByTestId('db-error-banner')).toBeNull();
  });

  it('shows the latest error by kind', () => {
    render(
      <MemoryRouter>
        <DbErrorBanner />
      </MemoryRouter>,
    );
    act(() => listener?.({ kind: 'quota', message: 'a', at: 1 }));
    act(() => listener?.({ kind: 'blocked', message: 'b', at: 2 }));
    expect(screen.getByTestId('db-error-banner')).toHaveTextContent(t.common.dbError.blocked);
  });

  it('also works outside a router (plain link)', () => {
    render(<DbErrorBanner />);
    act(() => listener?.({ kind: 'unknown', message: 'x', at: 1 }));
    expect(screen.getByRole('link', { name: t.common.dbError.exportLink })).toHaveAttribute(
      'href',
      '/settings',
    );
  });
});
