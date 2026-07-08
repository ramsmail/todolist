import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LabelsPage from '@/app/labels/page';

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
  return {
    ...actual,
    useLabelsWithStats: vi.fn(),
    updateLabel: vi.fn().mockResolvedValue(undefined),
    deleteLabel: vi.fn().mockResolvedValue(undefined),
    createLabel: vi.fn().mockResolvedValue('new-id'),
  };
});

// Mock CreateLabelModal to avoid nesting modal complexity in tests
vi.mock('@/components/labels/CreateLabelModal', () => ({
  CreateLabelModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="create-label-modal"><button onClick={onClose}>Close modal</button></div> : null,
}));

import { useLabelsWithStats, deleteLabel } from '@todolist/db';

const mockLabels = [
  { id: 'l1', name: 'work', color: '#6366F1', open_tasks: 5 },
  { id: 'l2', name: 'personal', color: '#10B981', open_tasks: 0 },
];

describe('LabelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLabelsWithStats as any).mockReturnValue({ data: mockLabels });
  });

  it('renders page title', () => {
    render(<LabelsPage />);
    expect(screen.getByRole('heading', { name: 'Labels' })).toBeInTheDocument();
  });

  it('shows label count and total open tasks in subtitle', () => {
    render(<LabelsPage />);
    expect(screen.getByText(/2 labels/)).toBeInTheDocument();
    expect(screen.getByText(/5 open tasks/)).toBeInTheDocument();
  });

  it('renders a row for each label', () => {
    render(<LabelsPage />);
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('shows open task count badge on each row', () => {
    render(<LabelsPage />);
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
    expect(screen.getByText('0 tasks')).toBeInTheDocument();
  });

  it('shows empty state when no labels', () => {
    (useLabelsWithStats as any).mockReturnValue({ data: [] });
    render(<LabelsPage />);
    expect(screen.getByText('No labels yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first label to get started.')).toBeInTheDocument();
  });

  it('renders the + New label button', () => {
    render(<LabelsPage />);
    expect(screen.getByText('+ New label')).toBeInTheDocument();
  });

  it('opens CreateLabelModal when + New label clicked', () => {
    render(<LabelsPage />);
    expect(screen.queryByTestId('create-label-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ New label'));
    expect(screen.getByTestId('create-label-modal')).toBeInTheDocument();
  });

  it('calls deleteLabel after confirm on delete click', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<LabelsPage />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete work/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(deleteLabel).toHaveBeenCalledWith(expect.anything(), 'l1'));
    vi.unstubAllGlobals();
  });

  it('does not call deleteLabel when confirm returns false', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<LabelsPage />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete work/i });
    fireEvent.click(deleteButtons[0]);
    expect(deleteLabel).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
