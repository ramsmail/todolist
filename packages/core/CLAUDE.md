# packages/core — Business Logic

Business logic only: task rules, recurrence calculations, filters/sorting, validation. This package is **entity-agnostic where possible** — written so a second entity type (notes, habits, projects) can reuse the same primitives instead of forking them.

## Hard Boundary

- **No React imports.** No DB client imports (`packages/db`, Supabase client, PowerSync client).
- **This package takes plain data in, returns plain data out.**
- If you find yourself needing a DB call inside `packages/core`, that's a sign the function belongs in the calling app layer instead — pass the data in as an argument.
- No `apps/web`-only or `apps/mobile`-only logic (no `next/*` imports, no `expo-*` imports). If platform-specific behavior seems necessary, it belongs in the app layer, not here.

## What Goes Here

- **Recurrence rule calculations** — next occurrence, RRULE-style logic
- **Filter/sort predicates** — for task lists and queries
- **Validation logic** — shared by both apps (e.g., "what makes a task valid?")
- **Pure transforms** — anything that's `(data) => data` with no side effects

## What Does NOT Go Here

- ❌ Anything that calls Supabase or PowerSync — that's `packages/db`
- ❌ Anything that renders UI — that's `packages/ui` or the app itself
- ❌ Anything platform-specific (Next.js, Expo APIs) — that's the app layer

## Architecture Pattern

**App layer orchestrates; core computes:**

```typescript
// ✅ apps/web/components/Dashboard.tsx
import { getTasks } from '@todolist/db';
import { filterByPriority } from '@todolist/core';

export function Dashboard() {
  const tasks = getTasks();                    // Get data from DB
  const highPriority = filterByPriority(tasks, 1); // Pass to pure core function
  return <TaskList tasks={highPriority} />;
}
```

**Wrong — core depends on db:**
```typescript
// ❌ packages/core/filters.ts
import { getTasks } from '@todolist/db';  // VIOLATION
export function getHighPriorityTasks() {
  return getTasks().filter(t => t.priority <= 2);
}
```

## Testing

- Pure functions only — test with `vitest` and plain data (no DB mocks needed)
- If a test requires mocking `packages/db` or React, that's usually a sign the function violates the boundary
- Run `pnpm test --filter @todolist/core` before considering a change done

## When Adding the Next Entity Type

Before forking a function to handle a new entity (e.g., a habit's recurrence vs. a task's recurrence), check whether the existing function can be generalized with a shared interface instead.

**Example:** Instead of `calculateTaskRecurrence()` and `calculateHabitRecurrence()`, ask if both can call a shared `calculateRecurrence(entity, rules)` where `entity` is any type with a due date.

This package's value depends on staying generalized rather than accumulating one-off variants per entity. Ask if unsure.
