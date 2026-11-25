import { describe, it, expect } from 'vitest';
import { quadrantLabel } from './types';

describe('quadrantLabel', () => {
  it('maps priority 1-4 to the Eisenhower matrix quadrant names', () => {
    expect(quadrantLabel[1]).toBe('Do First');
    expect(quadrantLabel[2]).toBe('Plan');
    expect(quadrantLabel[3]).toBe('Pass');
    expect(quadrantLabel[4]).toBe('Drop');
  });
});
