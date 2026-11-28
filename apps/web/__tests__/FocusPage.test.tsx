import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
  useQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@thinkdo/db', async () => {
  const actual = await vi.importActual<any>('@thinkdo/db');
  return { ...actual, useTodayTasks: vi.fn() };
});

import { useTodayTasks } from '@thinkdo/db';
import FocusPage from '@/app/focus/page';
import { FocusSessionProvider } from '@/lib/focus/FocusSessionContext';
import { ImmersiveProvider } from '@/lib/focus/ImmersiveContext';

const FOCUS_TASK_A = {
  id: 'f1', title: 'Review Q4 strategy document', in_focus: 1,
};
const FOCUS_TASK_B = {
  id: 'f2', title: 'Write release notes', in_focus: 1,
};
const OTHER_TASK = {
  id: 'o1', title: 'Not in focus', in_focus: 0,
};

function renderFocusPage() {
  return render(
    <FocusSessionProvider>
      <ImmersiveProvider>
        <FocusPage />
      </ImmersiveProvider>
    </FocusSessionProvider>
  );
}

describe('FocusPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('lists only in-focus tasks in the task picker', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK_A, FOCUS_TASK_B, OTHER_TASK] });
    renderFocusPage();
    expect(screen.getByText('Review Q4 strategy document')).toBeInTheDocument();
    expect(screen.getByText('Write release notes')).toBeInTheDocument();
    expect(screen.queryByText('Not in focus')).not.toBeInTheDocument();
  });

  it('shows the default round indicator and 25:00 before a task is selected', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK_A] });
    renderFocusPage();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText(/Duration: 25 min/)).toBeInTheDocument();
  });

  it('disables Play until a task is selected, then enables it', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK_A] });
    renderFocusPage();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f1' } });
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  it('starts the countdown once a task is selected and Play is clicked', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK_A] });
    renderFocusPage();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f1' } });
    act(() => { screen.getByRole('button', { name: 'Play' }).click(); });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('24:57')).toBeInTheDocument();
  });

  it('shows an empty state in the picker when there are no in-focus tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [OTHER_TASK] });
    renderFocusPage();
    expect(screen.getByText(/No tasks in focus/)).toBeInTheDocument();
  });

  it('renders the Enter Immersive Mode control', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK_A] });
    renderFocusPage();
    expect(screen.getByText('Enter Immersive Mode')).toBeInTheDocument();
  });
});
