import { describe, it, expect } from 'vitest';
import { resolveTaskPriority } from '../src/lib/resolveTaskPriority';

describe('resolveTaskPriority', () => {
  it('uses the explicit priority parsed from the input when it is not the silent default', () => {
    expect(resolveTaskPriority(1, 3)).toBe(1);
  });

  it('falls back to the default priority when the parsed priority is the silent default (4)', () => {
    expect(resolveTaskPriority(4, 2)).toBe(2);
  });

  it('returns the parsed default (4) when no default priority is provided', () => {
    expect(resolveTaskPriority(4, undefined)).toBe(4);
  });
});
