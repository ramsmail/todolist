import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateLabelModal } from '@/components/labels/CreateLabelModal';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return { ...actual, createLabel: vi.fn().mockResolvedValue('new-label-id') };
});

import { createLabel } from '@todolist/db';

describe('CreateLabelModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not render when closed', () => {
    render(<CreateLabelModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with name input and color swatches when open', () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Label name')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Color #/i })).toHaveLength(8);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CreateLabelModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables Create when name is empty', () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Create')).toBeDisabled();
  });

  it('calls createLabel with name and color on submit', async () => {
    const onClose = vi.fn();
    render(<CreateLabelModal open={true} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Label name'), {
      target: { value: 'urgent' },
    });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(createLabel).toHaveBeenCalledWith(
      expect.anything(),
      { userId: 'user-1', name: 'urgent', color: '#6366F1' }
    ));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits on Enter key in name input', async () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Label name');
    fireEvent.change(input, { target: { value: 'work' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(createLabel).toHaveBeenCalled());
  });

  it('resets name and color after successful creation', async () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Label name');
    fireEvent.change(input, { target: { value: 'urgent' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(createLabel).toHaveBeenCalled());
    // After creation the input should be reset
    expect(input.value).toBe('');
  });

  it('shows error message when createLabel throws', async () => {
    (createLabel as any).mockRejectedValueOnce(new Error('Server error'));
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Label name'), {
      target: { value: 'urgent' },
    });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('clears error when retrying after failure', async () => {
    (createLabel as any)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce('new-id');
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Label name');
    fireEvent.change(input, { target: { value: 'urgent' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => screen.getByText('Server error'));
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(screen.queryByText('Server error')).not.toBeInTheDocument());
  });
});
