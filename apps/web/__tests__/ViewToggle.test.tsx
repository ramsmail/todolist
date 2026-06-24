import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle } from '@/components/today/ViewToggle';
import { describe, it, expect, vi } from 'vitest';

describe('ViewToggle', () => {
  it('renders List and Board buttons', () => {
    const handleSetMode = vi.fn();
    render(<ViewToggle mode="list" setMode={handleSetMode} />);

    expect(screen.getByText('List')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('highlights List button when mode is list', () => {
    const handleSetMode = vi.fn();
    render(<ViewToggle mode="list" setMode={handleSetMode} />);

    const listBtn = screen.getByRole('button', { name: 'List' });
    expect(listBtn).toHaveClass('bg-accent');
  });

  it('highlights Board button when mode is board', () => {
    const handleSetMode = vi.fn();
    render(<ViewToggle mode="board" setMode={handleSetMode} />);

    const boardBtn = screen.getByRole('button', { name: 'Board' });
    expect(boardBtn).toHaveClass('bg-accent');
  });

  it('calls setMode when button is clicked', () => {
    const handleSetMode = vi.fn();
    render(<ViewToggle mode="list" setMode={handleSetMode} />);

    fireEvent.click(screen.getByText('Board'));
    expect(handleSetMode).toHaveBeenCalledWith('board');
  });
});
