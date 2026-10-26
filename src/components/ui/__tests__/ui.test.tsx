import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Dialog, IconButton, Select, TextInput } from '..';

function Harness({ onClose }: { onClose?: () => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>opener</button>
      <Dialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Hộp thoại"
      >
        <input aria-label="inner" />
      </Dialog>
    </div>
  );
}

afterEach(cleanup);

describe('ui primitives', () => {
  it('Dialog has aria attributes, moves focus in, Esc closes and returns focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText('opener');
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Hộp thoại' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('Dialog closes on backdrop click but not on panel click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('opener'));
    await user.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('dialog-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Dialog keeps Tab inside', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('opener'));
    for (let i = 0; i < 5; i++) await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('Dialog renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => undefined} title="x">
        body
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('IconButton exposes label as aria-label and title', () => {
    render(<IconButton label="Hoàn tác">↶</IconButton>);
    const b = screen.getByRole('button', { name: 'Hoàn tác' });
    expect(b).toHaveAttribute('title', 'Hoàn tác');
  });

  it('Button defaults to type=button and supports variants/disabled', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="primary" onClick={onClick}>
          go
        </Button>
        <Button variant="danger" size="sm" disabled onClick={onClick}>
          nope
        </Button>
      </>,
    );
    expect(screen.getByText('go')).toHaveAttribute('type', 'button');
    await userEvent.click(screen.getByText('go'));
    await userEvent.click(screen.getByText('nope'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('TextInput and Select associate their labels', async () => {
    render(
      <>
        <TextInput label="Tên" hint="gợi ý" defaultValue="a" />
        <Select label="Loại" defaultValue="2">
          <option value="1">Một</option>
          <option value="2">Hai</option>
        </Select>
      </>,
    );
    const input = screen.getByLabelText('Tên');
    expect(input).toHaveValue('a');
    expect(input).toHaveAccessibleDescription('gợi ý');
    await userEvent.selectOptions(screen.getByLabelText('Loại'), '1');
    expect(screen.getByLabelText('Loại')).toHaveValue('1');
  });
});

describe('Dialog responsive (D-25)', () => {
  it('renders as a full-screen sheet below 640px', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    try {
      render(
        <Dialog open onClose={() => undefined} title="T">
          x
        </Dialog>,
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('data-variant', 'sheet');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
