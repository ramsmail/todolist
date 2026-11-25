import { describe, it, expect } from 'vitest';
import { shouldRenderPriorityBadge } from './priorityBadgeLogic';

describe('shouldRenderPriorityBadge', () => {
  it('hides priority 4 (the default) when not interactive', () => {
    expect(shouldRenderPriorityBadge(4, false)).toBe(false);
  });

  it('shows priorities 1-3 when not interactive', () => {
    expect(shouldRenderPriorityBadge(1, false)).toBe(true);
    expect(shouldRenderPriorityBadge(2, false)).toBe(true);
    expect(shouldRenderPriorityBadge(3, false)).toBe(true);
  });

  it('always shows priority 4 when interactive', () => {
    expect(shouldRenderPriorityBadge(4, true)).toBe(true);
  });
});
