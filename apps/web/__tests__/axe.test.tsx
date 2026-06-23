import { render, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import { TaskRow } from '@/components/tasks/TaskRow';
import { LabelChip } from '@/components/tasks/LabelChip';
import { RecurrencePicker } from '@/components/tasks/RecurrencePicker';
import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';
import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';
import { ShortcutProvider, useShortcuts } from '@/lib/shortcuts/ShortcutContext';
import { describe, it, expect, vi } from 'vitest';

const TASK = { id: '1', title: 'Test task', priority: 3, due_date: '2026-12-01', status: 'inbox' };

vi.mock('@todolist/db', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useLabels:       vi.fn().mockReturnValue({ data: [] }),
    useProjects:     vi.fn().mockReturnValue({ data: [] }),
    useSavedFilters: vi.fn().mockReturnValue({ data: [] }),
    useLogbook:      vi.fn().mockReturnValue({ data: [] }),
  };
});
vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn(), getOptional: vi.fn().mockResolvedValue(null) }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}));

describe('Accessibility', () => {
  it('TaskRow has no axe violations', async () => {
    const { container } = render(
      <ul>
        <TaskRow task={TASK} onPress={vi.fn()} onComplete={vi.fn()} />
      </ul>
    );
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('LabelChip has no a11y violations', async () => {
    const { container } = render(<LabelChip name="home" color="#10B981" />);
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('RecurrencePicker has no a11y violations', async () => {
    const { container } = render(<RecurrencePicker value="FREQ=DAILY" onChange={() => {}} />);
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('FilterBuilderModal has no axe violations', async () => {
    const { container } = render(<FilterBuilderModal open={true} onClose={() => {}} />);
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('ShortcutsOverlay has no axe violations', async () => {
    function TestComponent() {
      const { openShortcuts } = useShortcuts();
      return (
        <>
          <button onClick={openShortcuts}>
            Open
          </button>
          <ShortcutsOverlay />
        </>
      );
    }
    const { getByText, container } = render(
      <ShortcutProvider><TestComponent /></ShortcutProvider>
    );
    fireEvent.click(getByText('Open'));
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });
});
