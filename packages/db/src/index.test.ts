import { describe, it, expect, vi } from 'vitest';
import { getInboxCount } from './index';

describe('getInboxCount', () => {
  it('returns the number of rows the inbox query returns', async () => {
    const db = { getAll: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]) } as any;
    expect(await getInboxCount(db)).toBe(2);
  });

  it('returns 0 for an empty inbox', async () => {
    const db = { getAll: vi.fn().mockResolvedValue([]) } as any;
    expect(await getInboxCount(db)).toBe(0);
  });
});
