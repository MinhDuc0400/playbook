import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeatureOverride } from '@/config/features';
import { makeSettings } from '@/db/__tests__/fixtures';
import { settingsRepo } from '@/db/repos';

vi.mock('@/db/errors', () => ({ onDbError: vi.fn(() => () => undefined) }));
vi.mock('../BackupBanner', () => ({ BackupBanner: () => null }));
vi.mock('@/features/playbook/PlaybookPage', () => ({ default: () => <p>page-home</p> }));
vi.mock('@/features/roster/RosterPage', () => ({ default: () => <p>page-roster</p> }));
vi.mock('@/features/suggest/SuggestPage', () => ({ default: () => <p>page-suggest</p> }));

import { routes } from '../router';

beforeEach(async () => {
  await settingsRepo.put(makeSettings());
});

function mount(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('feature route guards (D-26)', () => {
  it.each(['/roster', '/suggest'])('%s redirects to / in Simple mode', async (path) => {
    setFeatureOverride(false);
    mount(path);
    expect(await screen.findByText('page-home')).toBeInTheDocument();
    expect(screen.queryByText('page-roster')).toBeNull();
    expect(screen.queryByText('page-suggest')).toBeNull();
  });

  it('renders the routes in Advanced mode', async () => {
    setFeatureOverride(true);
    mount('/roster');
    expect(await screen.findByText('page-roster')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('page-home')).toBeNull());
  });
});
