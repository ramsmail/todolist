import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PowerSync
vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

// Mock @todolist/db createTask and ensureLabels
vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    createTask: vi.fn().mockResolvedValue('new-id'),
    ensureLabels: vi.fn().mockResolvedValue(undefined),
    useLabels: () => ({ data: [{ id: '1', name: 'work', color: '#6366F1' }, { id: '2', name: 'home', color: '#10B981' }] }),
  };
});

import { createTask, ensureLabels } from '@todolist/db';

describe('QuickCaptureModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(<QuickCaptureModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(<QuickCaptureModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn();
    render(<QuickCaptureModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('parses NLP and calls createTask on submit', async () => {
    const onClose = vi.fn();
    render(<QuickCaptureModal open={true} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Buy milk p1' },
    });
    fireEvent.click(screen.getByText('Add task'));
    await waitFor(() => expect(createTask).toHaveBeenCalled());
    const call = (createTask as any).mock.calls[0][1];
    expect(call.title).toBe('Buy milk');
    expect(call.priority).toBe(1);
  });

  it('passes recurrenceRule and ensures labels on save', async () => {
    const onClose = vi.fn();
    render(<QuickCaptureModal open={true} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Water plants @home every day' },
    });
    fireEvent.click(screen.getByText('Add task'));
    await waitFor(() => expect(createTask).toHaveBeenCalled());

    // Verify ensureLabels was called with ['home']
    expect(ensureLabels).toHaveBeenCalledWith(expect.anything(), 'user-1', ['home']);

    // Verify createTask was called with recurrenceRule and labels
    const call = (createTask as any).mock.calls[0][1];
    expect(call.labels).toEqual(['home']);
    expect(call.recurrenceRule).toBeDefined();
  });

  it('merges labels picked from the LabelPicker with inline @label syntax', async () => {
    const onClose = vi.fn();
    render(<QuickCaptureModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Add labels'));
    fireEvent.click(screen.getByRole('option', { name: 'work' }));
    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Water plants @home' },
    });
    fireEvent.click(screen.getByText('Add task'));
    await waitFor(() => expect(createTask).toHaveBeenCalled());

    const call = (createTask as any).mock.calls[0][1];
    expect(call.labels).toEqual(['work', 'home']);
    expect(ensureLabels).toHaveBeenCalledWith(expect.anything(), 'user-1', ['work', 'home']);
  });
});
