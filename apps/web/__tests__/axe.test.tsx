import { render } from '@testing-library/react';
import axe from 'axe-core';
import { TaskRow } from '@/components/tasks/TaskRow';
import { describe, it, expect, vi } from 'vitest';

const TASK = { id: '1', title: 'Test task', priority: 3, due_date: '2026-12-01', status: 'inbox' };

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
});
