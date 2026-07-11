import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LabelPicker } from '@/components/tasks/LabelPicker';

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useLabels: () => ({
      data: [
        { id: '1', name: 'work', color: '#6366F1' },
        { id: '2', name: 'home', color: '#10B981' },
      ],
    }),
  };
});

describe('LabelPicker', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<LabelPicker selected={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Add labels')).toBeInTheDocument();
  });

  it('shows selected labels as chips when closed', () => {
    render(<LabelPicker selected={['work']} onChange={vi.fn()} />);
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('opens a list of all known labels when clicked', () => {
    render(<LabelPicker selected={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add labels/i }));
    expect(screen.getByRole('option', { name: /work/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /home/i })).toBeInTheDocument();
  });

  it('calls onChange adding a label when an unselected option is clicked', () => {
    const onChange = vi.fn();
    render(<LabelPicker selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add labels/i }));
    fireEvent.click(screen.getByRole('option', { name: /work/i }));
    expect(onChange).toHaveBeenCalledWith(['work']);
  });

  it('calls onChange removing a label when a selected option is clicked', () => {
    const onChange = vi.fn();
    render(<LabelPicker selected={['work', 'home']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /work/i }));
    fireEvent.click(screen.getByRole('option', { name: /^work$/i }));
    expect(onChange).toHaveBeenCalledWith(['home']);
  });

  it('adds a new label name typed into the input on Enter', () => {
    const onChange = vi.fn();
    render(<LabelPicker selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add labels/i }));
    const input = screen.getByPlaceholderText('New label…');
    fireEvent.change(input, { target: { value: 'Errands' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['errands']);
  });
});
