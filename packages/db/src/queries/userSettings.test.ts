import { describe, it, expect, vi } from 'vitest';
import { upsertUserSettings } from './userSettings';

function makeMockDb(existing: { id: string } | null = null) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(existing),
  } as any;
}

describe('upsertUserSettings', () => {
  it('inserts a new row when none exists for this user', async () => {
    const db = makeMockDb(null);
    await upsertUserSettings(db, 'user-1', { nudge_enabled: 1, nudge_time: '09:00' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO user_settings');
    expect(params).toContain('user-1');
    expect(params).toContain(1);
    expect(params).toContain('09:00');
  });

  it('updates only the provided fields when a row already exists', async () => {
    const db = makeMockDb({ id: 'user-1' });
    await upsertUserSettings(db, 'user-1', { expo_push_token: 'ExponentPushToken[abc]' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE user_settings');
    expect(sql).toContain('expo_push_token = ?');
    expect(sql).not.toContain('nudge_time = ?');
    expect(params).toContain('ExponentPushToken[abc]');
  });

  it('does nothing on update when no fields are provided', async () => {
    const db = makeMockDb({ id: 'user-1' });
    await upsertUserSettings(db, 'user-1', {});
    expect(db.execute).not.toHaveBeenCalled();
  });
});
