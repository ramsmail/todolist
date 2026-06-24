import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn(), getOptional: vi.fn().mockResolvedValue(null) }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));
vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useLabels:          vi.fn(),
    useProjects:        vi.fn(),
    createSavedFilter:  vi.fn().mockResolvedValue('new-filter-id'),
    updateSavedFilter:  vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock('@todolist/core', async () => {
  const actual = await vi.importActual<any>('@todolist/core');
  return {
    ...actual,
    serializeFilterQuery: (q: any) => JSON.stringify(q),
    isEmptyFilterQuery: (q: any) => {
      return (
        (!q.priority || q.priority.length === 0) &&
        (!q.labels || q.labels.length === 0) &&
        q.projectId === undefined &&
        q.dueDateRange === undefined
      );
    },
  };
});

import { useLabels, useProjects, createSavedFilter, updateSavedFilter } from '@todolist/db';
import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';

describe.skip('FilterBuilderModal', () => {
  beforeEach(() => {
    (useLabels as any).mockReturnValue({ data: [{ id: 'l1', name: 'home', color: '#10B981', deleted_at: null }] });
    (useProjects as any).mockReturnValue({ data: [{ id: 'p1', name: 'Work', color: '#6366F1', deleted_at: null }] });
    vi.clearAllMocks();
    (createSavedFilter as any).mockResolvedValue('new-filter-id');
    (updateSavedFilter as any).mockResolvedValue(undefined);
    (useLabels as any).mockReturnValue({ data: [{ id: 'l1', name: 'home', color: '#10B981', deleted_at: null }] });
    (useProjects as any).mockReturnValue({ data: [{ id: 'p1', name: 'Work', color: '#6366F1', deleted_at: null }] });
  });

  it('does not render when closed', () => {
    render(<FilterBuilderModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders form when open', () => {
    render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter name')).toBeInTheDocument();
  });

  it('Save button is disabled when name is empty', () => {
    render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('Save button is disabled when name is set but no criteria are selected', () => {
    render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'My filter' } });
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('Save is enabled when name + at least one criterion set', () => {
    render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'My filter' } });
    fireEvent.click(screen.getByText('P1'));
    expect(screen.getByText('Save')).not.toBeDisabled();
  });

  it('calls createSavedFilter with correct query on save', async () => {
    render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'Urgent' } });
    fireEvent.click(screen.getByText('P1'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(createSavedFilter).toHaveBeenCalled());
    const [, fields] = (createSavedFilter as any).mock.calls[0];
    expect(fields.name).toBe('Urgent');
    expect(fields.query).toContain('"priority":[1]');
  });

  it('calls updateSavedFilter when editing an existing filter', async () => {
    const existing = {
      id: 'f1', name: 'Old name', icon: null,
      query: '{"priority":[2]}',
      sort_order: 'a0', created_at: '', updated_at: '', deleted_at: null, user_id: 'u1',
    };
    render(<FilterBuilderModal open={true} onClose={vi.fn()} filter={existing} />);
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updateSavedFilter).toHaveBeenCalled());
  });
});
