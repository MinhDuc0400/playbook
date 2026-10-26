import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/vi';

vi.mock('@/db/errors', () => ({ onDbError: vi.fn(() => () => undefined) }));
vi.mock('../BackupBanner', () => ({ BackupBanner: () => null }));

import { Layout } from '../Layout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/roster']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<p>home</p>} />
          <Route path="roster" element={<input aria-label="field" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('Layout', () => {
  it('renders nav links, the app name and the outlet', () => {
    renderLayout();
    expect(screen.getByText(t.common.appName)).toBeInTheDocument();
    for (const id of ['playbook', 'install', 'roster', 'suggest', 'settings']) {
      expect(screen.getByTestId(`nav-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('nav-roster')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-playbook')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('nav-settings')).toHaveAttribute('href', '/settings');
    expect(screen.getByLabelText('field')).toBeInTheDocument();
  });

  it('? opens the shortcut sheet listing the shortcuts; Esc closes it', async () => {
    const user = userEvent.setup();
    renderLayout();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.keyboard('?');
    const dialog = screen.getByRole('dialog', { name: t.common.shortcuts.title });
    expect(dialog).toHaveTextContent('Flip play');
    expect(dialog).toHaveTextContent('Ctrl+Z / Ctrl+Shift+Z');
    expect(dialog).toHaveTextContent('Khóa góc 45°');
    expect(dialog).toHaveTextContent('Đặt cầu thủ đang chọn thành Kém / TB / Hay');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the header button opens the sheet', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole('button', { name: t.common.shortcuts.open }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('? typed inside an input does not open the sheet', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByLabelText('field'));
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('field')).toHaveValue('?');
  });
});

describe('Layout (phone)', () => {
  it('shows a menu button, hides links until opened, closes on navigate', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: !q.includes('min-width'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    try {
      renderLayout();
      const btn = screen.getByTestId('nav-menu-button');
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('nav-settings')).toBeNull();
      await userEvent.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');
      for (const id of ['playbook', 'install', 'roster', 'suggest', 'settings']) {
        expect(screen.getByTestId(`nav-${id}`)).toBeInTheDocument();
      }
      await userEvent.click(screen.getByTestId('nav-playbook'));
      expect(screen.queryByTestId('nav-settings')).toBeNull();
      expect(screen.getByText('home')).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
