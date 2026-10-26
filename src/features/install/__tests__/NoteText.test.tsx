import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoteText } from '../NoteText';

describe('NoteText (FR-IN-03)', () => {
  it('keeps line breaks and renders "- " and bullet lines as list items', () => {
    render(<NoteText text={'Intro\nSecond line\n- one\n• two\nEnd'} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['one', 'two']);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Second line')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByTestId('note-text').children).toHaveLength(4);
  });
});
