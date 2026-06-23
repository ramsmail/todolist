import { describe, it, expect } from 'vitest';
import { pickLabelColor, renameInLabelArray, removeFromLabelArray } from './labelUtils';

describe('labelUtils', () => {
  it('pickLabelColor is deterministic and from the palette', () => {
    const a = pickLabelColor('groceries');
    const b = pickLabelColor('groceries');
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('renameInLabelArray replaces and de-dupes', () => {
    expect(renameInLabelArray(['work', 'urgent'], 'work', 'job')).toEqual(['job', 'urgent']);
    expect(renameInLabelArray(['work', 'job'], 'work', 'job')).toEqual(['job']);
  });

  it('removeFromLabelArray drops the name', () => {
    expect(removeFromLabelArray(['work', 'urgent'], 'work')).toEqual(['urgent']);
  });
});
