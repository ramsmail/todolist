import { describe, it, expect } from 'vitest';
import { resolvePanelTint, priorityPanelTint } from './tokens';

describe('resolvePanelTint', () => {
  it('returns the matching tint for priorities 1-4', () => {
    expect(resolvePanelTint(1)).toBe(priorityPanelTint[1]);
    expect(resolvePanelTint(2)).toBe(priorityPanelTint[2]);
    expect(resolvePanelTint(3)).toBe(priorityPanelTint[3]);
    expect(resolvePanelTint(4)).toBe(priorityPanelTint[4]);
  });

  it('defaults null to the P4 tint', () => {
    expect(resolvePanelTint(null)).toBe(priorityPanelTint[4]);
  });

  it('defaults undefined to the P4 tint', () => {
    expect(resolvePanelTint(undefined)).toBe(priorityPanelTint[4]);
  });

  it('defaults an out-of-range priority to the P4 tint', () => {
    expect(resolvePanelTint(99)).toBe(priorityPanelTint[4]);
  });
});
