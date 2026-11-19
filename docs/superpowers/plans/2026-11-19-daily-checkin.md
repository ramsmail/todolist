# Daily Check-in Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily local notification (default 10:00) with a custom chime that nudges the user to open the todo app, independent of the existing inbox nudge and P1 cards.

**Architecture:** Two new `user_settings` columns (`checkin_enabled`, `checkin_time`) flow through the usual migration → sync rules (already `SELECT *`) → `packages/db` chain. The mobile reconciler gains `reconcileCheckin()`, which schedules an Expo `DAILY` trigger on a new Android channel `checkin` that plays a bundled `checkin.wav`. Body text rotates from a small list of friendly lines.

**Tech Stack:** Supabase Postgres, PowerSync, Expo SDK 56 (`expo-notifications ~56.0.21`), vitest, Python 3 stdlib (sound generation).

**Spec:** `docs/superpowers/specs/2026-11-19-daily-checkin-design.md`

**Branch:** `feat/daily-checkin` (already created; based on `fix/pomodoro-resume`, which contains the DAILY-trigger change this builds on).

**Do not commit** the pre-existing unrelated working-tree changes (`apps/web/tsconfig.tsbuildinfo`, `eas.json`, root `app.json`, other plan files). Always `git add` explicit paths.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20261119000001_daily_checkin.sql` | Create | Add the two columns |
| `packages/db/src/schema.ts` | Modify | PowerSync column types |
| `packages/db/src/queries/userSettings.ts` | Modify | Allow writing the new columns |
| `packages/db/src/queries/userSettings.test.ts` | Modify | Tests for the above |
| `apps/mobile/scripts/generate-checkin-sound.py` | Create | Deterministically synthesize the chime |
| `apps/mobile/assets/sounds/checkin.wav` | Create (generated) | The chime |
| `apps/mobile/app.json` | Modify | Register sound with `expo-notifications` plugin |
| `apps/mobile/src/notifications/checkinContent.ts` | Create | Lines list, `pickCheckinLine`, `normalizeCheckinTime` |
| `apps/mobile/__tests__/checkinContent.test.ts` | Create | Tests for the above |
| `apps/mobile/src/notifications/reconciliation.ts` | Modify | `reconcileCheckin()` |
| `apps/mobile/__tests__/reconciliation.test.ts` | Modify | Tests for `reconcileCheckin` |
| `apps/mobile/src/notifications/setup.ts` | Modify | `checkin` category + Android channel with sound |
| `apps/mobile/src/hooks/useNotificationReconciliation.ts` | Modify | Wire deps, call `reconcileCheckin` |
| `apps/mobile/src/app/settings.tsx` | Modify | Toggle + time picker UI |

---

### Task 1: Migration, applied and verified LIVE

**Files:**
- Create: `supabase/migrations/20261119000001_daily_checkin.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Daily check-in: a Duolingo-style "open the app" alert that fires every day
-- at checkin_time with a custom sound, independent of the inbox nudge
-- (nudge_enabled/nudge_time) and P1 cards. Existing own_settings RLS policy on
-- user_settings covers these columns; sync rules use SELECT * so they replicate.
-- See docs/superpowers/specs/2026-11-19-daily-checkin-design.md.

alter table user_settings add column checkin_enabled boolean not null default false;
alter table user_settings add column checkin_time text not null default '10:00';
```

- [ ] **Step 2: Probe the live DB (expect the column to be MISSING)**

```bash
cd /home/rameshv/Repos/Projects/todolist
set -a; . apps/mobile/.env; set +a
curl -s -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/user_settings?select=checkin_enabled,checkin_time&limit=1"
```
Expected: an error containing `42703` / `does not exist`.

- [ ] **Step 3: Apply to the live DB**

Run: `supabase db push` (project must be linked; if not, ask the user to run `! supabase link` or paste the SQL into the Supabase dashboard SQL editor). Confirm with the user before pushing — this changes the production database.

If `db push` reports other un-applied migrations besides this one, STOP and report to the user (migration drift — see memory "schema-first-bottom-up").

- [ ] **Step 4: Re-run the probe from Step 2**

Expected: `[]` (RLS hides rows from anon, but no column error = column exists).

- [ ] **Step 5: Confirm sync rules need no edit**

Run: `grep -n "user_settings" powersync/sync-rules.yaml`
Expected: `- SELECT * FROM user_settings   WHERE id       = auth.user_id()` — `SELECT *` covers new columns. No change.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261119000001_daily_checkin.sql
git commit -m "feat(db): add checkin_enabled and checkin_time to user_settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `packages/db` schema + writable fields

**Files:**
- Modify: `packages/db/src/schema.ts` (user_settings table, ~line 112-123)
- Modify: `packages/db/src/queries/userSettings.ts:18,38-42`
- Test: `packages/db/src/queries/userSettings.test.ts`

- [ ] **Step 1: Write the failing tests** — append inside the `describe('upsertUserSettings', ...)` block:

```ts
  it('inserts checkin defaults (off, 10:00) when a new row is created without them', async () => {
    const db = makeMockDb(null);
    await upsertUserSettings(db, 'user-1', { timezone: 'Asia/Kolkata' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('checkin_enabled');
    expect(sql).toContain('checkin_time');
    expect(params).toContain('10:00');
  });

  it('writes checkin fields on update', async () => {
    const db = makeMockDb({ id: 'user-1' });
    await upsertUserSettings(db, 'user-1', { checkin_enabled: 1, checkin_time: '10:30' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('checkin_enabled = ?');
    expect(sql).toContain('checkin_time = ?');
    expect(params).toEqual(expect.arrayContaining([1, '10:30', 'user-1']));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/db test -- userSettings`
Expected: FAIL (type error on `checkin_enabled` and/or SQL missing `checkin_enabled`).

- [ ] **Step 3: Add columns to `schema.ts`** — in the `user_settings` table, after `p1_cards_enabled`:

```ts
  p1_cards_enabled:      column.integer,
  checkin_enabled:       column.integer,
  checkin_time:          column.text,
  created_at:            column.text,
```

- [ ] **Step 4: Update `userSettings.ts`**

Replace line 18:
```ts
type WritableFields = Partial<Pick<UserSettingsRecord, 'timezone' | 'expo_push_token' | 'nudge_enabled' | 'nudge_time' | 'p1_cards_enabled' | 'checkin_enabled' | 'checkin_time'>>;
```

Replace the INSERT branch (the `else { ... }` body):
```ts
    // checkin_time defaults to '10:00' to mirror the Postgres column default —
    // inserting NULL here would violate its NOT NULL constraint on upload.
    await db.execute(
      `INSERT INTO user_settings (id, timezone, expo_push_token, nudge_enabled, nudge_time, p1_cards_enabled, checkin_enabled, checkin_time, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        fields.timezone ?? null,
        fields.expo_push_token ?? null,
        fields.nudge_enabled ?? 0,
        fields.nudge_time ?? null,
        fields.p1_cards_enabled ?? 0,
        fields.checkin_enabled ?? 0,
        fields.checkin_time ?? '10:00',
        now,
        now,
      ]
    );
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @todolist/db test`
Expected: all PASS.

- [ ] **Step 6: Build the package** (mobile consumes built output)

Run: `pnpm --filter @todolist/db build`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/queries/userSettings.ts packages/db/src/queries/userSettings.test.ts
git commit -m "feat(db): expose checkin settings in PowerSync schema and upsert

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Generate the chime and register it

**Files:**
- Create: `apps/mobile/scripts/generate-checkin-sound.py`
- Create: `apps/mobile/assets/sounds/checkin.wav` (generated)
- Modify: `apps/mobile/app.json` (the `"expo-notifications",` plugin entry, ~line 41)

- [ ] **Step 1: Write the generator**

```python
#!/usr/bin/env python3
"""Generate apps/mobile/assets/sounds/checkin.wav — the daily check-in chime.

A bright rising major arpeggio (E5, G#5, B5, E6) with a soft bell timbre.
Deterministic (no randomness) so re-running produces an identical file.
Stdlib only. Output: 44.1 kHz, 16-bit, mono PCM WAV, ~1.2 s (iOS requires
custom notification sounds to be < 30 s and .wav/.caf/.aiff).

Usage: python3 apps/mobile/scripts/generate-checkin-sound.py
"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds" / "checkin.wav"

# (frequency Hz, start s, duration s)
NOTES = [
    (659.25, 0.00, 0.35),
    (830.61, 0.12, 0.35),
    (987.77, 0.24, 0.40),
    (1318.51, 0.40, 0.80),
]
TOTAL = 1.25


def bell(freq: float, t: float, dur: float) -> float:
    if t < 0 or t > dur:
        return 0.0
    attack = min(1.0, t / 0.005)          # 5 ms attack, avoids a click
    decay = math.exp(-4.5 * t / dur)      # bell-like exponential decay
    tone = (
        math.sin(2 * math.pi * freq * t)
        + 0.35 * math.sin(2 * math.pi * freq * 2 * t)
        + 0.12 * math.sin(2 * math.pi * freq * 3 * t)
    )
    return attack * decay * tone


def main() -> None:
    n = int(RATE * TOTAL)
    samples = []
    for i in range(n):
        t = i / RATE
        samples.append(sum(bell(f, t - start, dur) for f, start, dur in NOTES))
    peak = max(abs(s) for s in samples) or 1.0
    scale = 0.85 * 32767 / peak
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(s * scale)) for s in samples))
    print(f"wrote {OUT} ({TOTAL:.2f}s)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python3 -I apps/mobile/scripts/generate-checkin-sound.py`
Expected: `wrote .../apps/mobile/assets/sounds/checkin.wav (1.25s)`

- [ ] **Step 3: Verify the file**

Run: `python3 -I -c "import wave; w=wave.open('apps/mobile/assets/sounds/checkin.wav'); print(w.getnchannels(), w.getsampwidth(), w.getframerate(), round(w.getnframes()/w.getframerate(),2))"`
Expected: `1 2 44100 1.25`

- [ ] **Step 4: Let the user listen** — tell the user the full absolute path `/home/rameshv/Repos/Projects/todolist/apps/mobile/assets/sounds/checkin.wav` and ask them to play it (e.g. `! aplay apps/mobile/assets/sounds/checkin.wav`). If they want it changed, adjust `NOTES`/`TOTAL` and regenerate.

- [ ] **Step 5: Register in `app.json`** — replace the bare `"expo-notifications",` plugin entry with:

```json
      [
        "expo-notifications",
        {
          "sounds": ["./assets/sounds/checkin.wav"]
        }
      ],
```

- [ ] **Step 6: Validate the config resolves**

Run: `cd apps/mobile && npx expo config --type prebuild > /dev/null && echo OK`
Expected: `OK` (no plugin errors).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/scripts/generate-checkin-sound.py apps/mobile/assets/sounds/checkin.wav apps/mobile/app.json
git commit -m "feat(mobile): add generated check-in chime and register notification sound

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Check-in content helpers

**Files:**
- Create: `apps/mobile/src/notifications/checkinContent.ts`
- Test: `apps/mobile/__tests__/checkinContent.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { CHECKIN_LINES, pickCheckinLine, normalizeCheckinTime } from '../src/notifications/checkinContent';

describe('pickCheckinLine', () => {
  it('returns the same line for the same calendar day, regardless of time', () => {
    expect(pickCheckinLine(new Date(2026, 10, 19, 0, 5))).toBe(pickCheckinLine(new Date(2026, 10, 19, 23, 55)));
  });

  it('returns a different line on consecutive days', () => {
    expect(pickCheckinLine(new Date(2026, 10, 19))).not.toBe(pickCheckinLine(new Date(2026, 10, 20)));
  });

  it('always returns one of the defined non-empty lines', () => {
    for (let d = 1; d <= 40; d++) {
      const line = pickCheckinLine(new Date(2026, 0, d));
      expect(CHECKIN_LINES).toContain(line);
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeCheckinTime', () => {
  it('passes through a valid HH:MM', () => {
    expect(normalizeCheckinTime('07:45')).toBe('07:45');
  });

  it('falls back to 10:00 for null, empty, or malformed values', () => {
    expect(normalizeCheckinTime(null)).toBe('10:00');
    expect(normalizeCheckinTime('')).toBe('10:00');
    expect(normalizeCheckinTime('25:00')).toBe('10:00');
    expect(normalizeCheckinTime('9am')).toBe('10:00');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/mobile test -- --run checkinContent`
Expected: FAIL — cannot resolve `../src/notifications/checkinContent`.

- [ ] **Step 3: Implement**

```ts
// apps/mobile/src/notifications/checkinContent.ts
//
// Copy and time parsing for the daily check-in alert. Pure functions so they
// are unit-testable without Expo.

export const CHECKIN_LINES = [
  'Time to plan your day ☀️',
  'Your tasks miss you 👀',
  'Two minutes now saves an hour later. Open your list ✅',
  "What's the one thing that matters today? 🎯",
  "Quick check-in: what's on your plate? 📝",
  'Small steps, every day. Take a look 🚶',
] as const;

export const DEFAULT_CHECKIN_TIME = '10:00';

// Indexed by local calendar day so the line is stable within a day and
// changes the next day. Date.UTC on local Y/M/D gives a DST-proof day number.
export function pickCheckinLine(date: Date): string {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return CHECKIN_LINES[dayNumber % CHECKIN_LINES.length];
}

// The DAILY trigger needs numeric hour/minute; a malformed stored value would
// otherwise produce NaN and silently schedule nothing.
export function normalizeCheckinTime(time: string | null | undefined): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return match ? time! : DEFAULT_CHECKIN_TIME;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/mobile test -- --run checkinContent`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/notifications/checkinContent.ts apps/mobile/__tests__/checkinContent.test.ts
git commit -m "feat(mobile): add check-in notification copy and time helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `reconcileCheckin` in the reconciler

**Files:**
- Modify: `apps/mobile/src/notifications/reconciliation.ts`
- Test: `apps/mobile/__tests__/reconciliation.test.ts`

- [ ] **Step 1: Write the failing tests**

In `makeDeps` in `reconciliation.test.ts`, add two defaults before `...overrides`:
```ts
    getCheckinSettings: vi.fn().mockResolvedValue({ enabled: false, time: '10:00' }),
    scheduleCheckinNotification: vi.fn().mockResolvedValue('checkin-1'),
```

Add the import at the top:
```ts
import { CHECKIN_LINES } from '../src/notifications/checkinContent';
```

Append a new describe block at the end of the file:
```ts
describe('reconcileCheckin', () => {
  it('schedules nothing when disabled', async () => {
    const deps = makeDeps();
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    expect(deps.scheduleCheckinNotification).not.toHaveBeenCalled();
  });

  it('schedules at the configured time with a check-in line when enabled, even with an empty inbox', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn().mockResolvedValue({ enabled: true, time: '10:00' }),
      getInboxCount: vi.fn().mockResolvedValue(0),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    expect(deps.scheduleCheckinNotification).toHaveBeenCalledTimes(1);
    const [time, body] = deps.scheduleCheckinNotification.mock.calls[0];
    expect(time).toBe('10:00');
    expect(CHECKIN_LINES).toContain(body);
  });

  it('replaces rather than stacks: cancels the previous check-in before rescheduling', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn().mockResolvedValue({ enabled: true, time: '10:00' }),
      scheduleCheckinNotification: vi.fn().mockResolvedValueOnce('checkin-1').mockResolvedValueOnce('checkin-2'),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    await reconciler.reconcileCheckin();
    expect(deps.cancelNotification).toHaveBeenCalledWith('checkin-1');
    expect(deps.scheduleCheckinNotification).toHaveBeenCalledTimes(2);
  });

  it('reschedules at the new time after the time setting changes', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn()
        .mockResolvedValueOnce({ enabled: true, time: '10:00' })
        .mockResolvedValueOnce({ enabled: true, time: '07:30' }),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    await reconciler.reconcileCheckin();
    expect(deps.scheduleCheckinNotification.mock.calls[1][0]).toBe('07:30');
  });

  it('cancels and does not reschedule after being disabled', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn()
        .mockResolvedValueOnce({ enabled: true, time: '10:00' })
        .mockResolvedValueOnce({ enabled: false, time: '10:00' }),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    await reconciler.reconcileCheckin();
    expect(deps.cancelNotification).toHaveBeenCalledWith('checkin-1');
    expect(deps.scheduleCheckinNotification).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/mobile test -- --run reconciliation`
Expected: new tests FAIL with `reconciler.reconcileCheckin is not a function`; existing tests PASS.

- [ ] **Step 3: Implement in `reconciliation.ts`**

Add import at top:
```ts
import { pickCheckinLine } from './checkinContent';
```

Add interface after `P1CardSettings`:
```ts
export interface CheckinSettings {
  enabled: boolean;
  time: string;
}
```

Add to `ReconciliationDeps` (after `scheduleP1CardNotification`):
```ts
  getCheckinSettings: () => Promise<CheckinSettings>;
  scheduleCheckinNotification: (time: string, body: string) => Promise<string>;
```

Add state after `scheduledP1Cards`:
```ts
  let scheduledCheckinId: string | null = null;
```

Add function before `return`:
```ts
  // Like the nudge, content is frozen at schedule time, so rescheduling on
  // every pass is what rotates the line. Unlike the nudge, there is no
  // emptiness condition: the check-in always fires when enabled.
  async function reconcileCheckin(): Promise<void> {
    if (scheduledCheckinId) {
      await deps.cancelNotification(scheduledCheckinId);
      scheduledCheckinId = null;
    }

    const settings = await deps.getCheckinSettings();
    if (!settings.enabled) return;

    scheduledCheckinId = await deps.scheduleCheckinNotification(settings.time, pickCheckinLine(new Date()));
  }
```

Change the return:
```ts
  return { reconcileReminders, reconcileNudge, reconcileP1Cards, reconcileCheckin };
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/mobile test -- --run reconciliation`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/notifications/reconciliation.ts apps/mobile/__tests__/reconciliation.test.ts
git commit -m "feat(mobile): reconcile daily check-in notification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Channel/category setup and hook wiring

**Files:**
- Modify: `apps/mobile/src/notifications/setup.ts`
- Modify: `apps/mobile/src/hooks/useNotificationReconciliation.ts`

No unit test (thin Expo glue; covered by device test in Task 8). Typecheck is the gate.

- [ ] **Step 1: `setup.ts` — register category.** After the `p1_card` category block, add:
```ts
  await Notifications.setNotificationCategoryAsync('checkin', []);
```

- [ ] **Step 2: `setup.ts` — add the channel.** Inside `if (Platform.OS === 'android') { ... }`, after the `triage` channel:
```ts
    // Separate channel because Android locks a channel's sound at creation —
    // the custom chime can't be added to 'triage' for existing installs. The
    // sound name is the base filename registered via the expo-notifications
    // plugin's `sounds` array in app.json.
    await Notifications.setNotificationChannelAsync('checkin', {
      name: 'Daily check-in',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'checkin.wav',
    });
```

- [ ] **Step 3: Hook — imports.** In `useNotificationReconciliation.ts` add:
```ts
import { normalizeCheckinTime } from '../notifications/checkinContent';
```

- [ ] **Step 4: Hook — deps.** Inside `createReconciler({ ... })`, after `scheduleP1CardNotification`, add:
```ts
        getCheckinSettings: async () => {
          const settings = await getUserSettings(db);
          return {
            enabled: !!settings?.checkin_enabled,
            time: normalizeCheckinTime(settings?.checkin_time),
          };
        },

        scheduleCheckinNotification: (time, body) =>
          Notifications.scheduleNotificationAsync({
            // Fixed identifier: rescheduling replaces the OS-level entry even
            // after an app restart, when the reconciler's in-memory id is gone.
            identifier: 'checkin',
            content: {
              title: 'Daily check-in',
              body,
              sound: 'checkin.wav', // iOS; Android plays the channel's sound
              categoryIdentifier: 'checkin',
              data: { url: '/', type: 'checkin' },
            },
            trigger: dailyTrigger(time, 'checkin'),
          }),
```

- [ ] **Step 5: Hook — call sites.** In `reconcileAll`, add:
```ts
        reconciler.reconcileCheckin().catch(console.error);
```
In the `nextState === 'background'` branch, add:
```ts
          reconciler.reconcileCheckin().catch(console.error);
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/notifications/setup.ts apps/mobile/src/hooks/useNotificationReconciliation.ts
git commit -m "feat(mobile): schedule daily check-in on its own sound channel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Settings UI

**Files:**
- Modify: `apps/mobile/src/app/settings.tsx`

The existing time picker is hard-wired to `nudge_time`. Generalize it to a target field so both rows share one picker. Leave the TEMPORARY DIAGNOSTIC blocks untouched.

- [ ] **Step 1: Picker target type.** Below `formatTime`, add:
```ts
type TimeField = 'nudge_time' | 'checkin_time';
```

- [ ] **Step 2: State + derived values.** Replace
```ts
  const [showIosPicker, setShowIosPicker] = useState(false);
```
with
```ts
  const [iosPickerFor, setIosPickerFor] = useState<TimeField | null>(null);
```
and after `const p1CardsEnabled = ...;` add:
```ts
  const checkinEnabled = !!settings?.checkin_enabled;
  const checkinTime = settings?.checkin_time ?? '10:00';
```

- [ ] **Step 3: Check-in toggle handler.** After `handleP1Toggle`, add:
```ts
  const handleCheckinToggle = useCallback(async (value: boolean) => {
    if (!userId) {
      Alert.alert('Not signed in', 'Your session is not ready yet — try again in a moment.');
      return;
    }
    try {
      if (value) {
        const { granted, canAskAgain } = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications disabled',
            canAskAgain
              ? 'Notification permission was not granted. Please allow notifications to use the daily check-in.'
              : 'Notifications are blocked for this app. Enable them in your device Settings > Apps > TodoList > Notifications to use the daily check-in.'
          );
          return;
        }
      }
      await upsertUserSettings(db as any, userId, { checkin_enabled: value ? 1 : 0, checkin_time: checkinTime });
    } catch (err) {
      console.error('[settings] failed to update daily check-in setting:', err);
      Alert.alert('Something went wrong', `Could not update the daily check-in setting: ${String((err as any)?.message ?? err)}`);
    }
  }, [db, userId, checkinTime]);
```

- [ ] **Step 4: Generalize time picking.** Replace the existing `applyTime`, `openTimePicker`, and `handleIosChange` callbacks with:
```ts
  const applyTime = useCallback((field: TimeField, date: Date) => {
    if (!userId) return;
    const value = formatTime(date);
    // Explicit branches rather than a computed key: `{ [field]: value }` widens
    // to an index signature that isn't assignable to WritableFields.
    const fields = field === 'nudge_time' ? { nudge_time: value } : { checkin_time: value };
    upsertUserSettings(db as any, userId, fields).catch(console.error);
  }, [db, userId]);

  const openTimePicker = useCallback((field: TimeField) => {
    const value = parseTime(field === 'nudge_time' ? nudgeTime : checkinTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: 'time', display: 'default',
        onValueChange: (_e, selectedDate) => { if (selectedDate) applyTime(field, selectedDate); },
      });
    } else {
      setIosPickerFor(field);
    }
  }, [nudgeTime, checkinTime, applyTime]);

  const handleIosChange = useCallback((_event: unknown, selectedDate?: Date) => {
    const field = iosPickerFor;
    setIosPickerFor(null);
    if (field && selectedDate) applyTime(field, selectedDate);
  }, [iosPickerFor, applyTime]);
```

- [ ] **Step 5: JSX.** Change the nudge time row's `onPress={openTimePicker}` to `onPress={() => openTimePicker('nudge_time')}`.

Replace the iOS picker block with:
```tsx
      {iosPickerFor && (
        <DateTimePicker
          value={parseTime(iosPickerFor === 'nudge_time' ? nudgeTime : checkinTime)}
          mode="time"
          display="default"
          onValueChange={handleIosChange}
          onDismiss={() => setIosPickerFor(null)}
        />
      )}
```

Directly after `<Text style={styles.heading}>Settings</Text>` (before the "Daily inbox nudge" row), add the check-in section — it is the primary daily alert, so it goes first:
```tsx
      <View style={styles.row}>
        <Text style={styles.label}>Daily check-in</Text>
        <Switch value={checkinEnabled} onValueChange={handleCheckinToggle} />
      </View>

      {checkinEnabled && (
        <Pressable style={styles.row} onPress={() => openTimePicker('checkin_time')}>
          <Text style={styles.label}>Check-in time</Text>
          <Text style={styles.value}>{checkinTime}</Text>
        </Pressable>
      )}
```

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app/settings.tsx
git commit -m "feat(mobile): add daily check-in toggle and time to settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Full verification

- [ ] **Step 1: Full checks** — run and show output:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @todolist/mobile test -- --run && pnpm --filter @todolist/db test
```
Expected: all pass.

- [ ] **Step 2: New EAS build** — bundled sounds are native assets; an OTA update will NOT carry them. Ask the user before starting a build (it uses EAS quota). Use the preview build + install-link flow (memory: "Mobile preview build install flow"): `cd apps/mobile && eas build --profile preview --platform android`.

- [ ] **Step 3: Device test (user performs, Claude guides)**
  1. Install the build, sign in, open Settings → turn on **Daily check-in** → set time to 2 minutes from now.
  2. Confirm the setting synced: on web or via Supabase dashboard, the user's `user_settings` row shows `checkin_enabled = true` and the new `checkin_time` (proves the column reached Postgres — silent-failure check).
  3. Background/kill the app. At the set time, the notification "Daily check-in" appears as a heads-up with the **custom chime**.
  4. Tap it → app opens on Home.
  5. Set time back to 10:00.

- [ ] **Step 4: Finish** — use superpowers:finishing-a-development-branch.
