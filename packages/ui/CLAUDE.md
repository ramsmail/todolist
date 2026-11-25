# packages/ui — Shared UI Components

Reusable React components, design tokens, and styling shared by `apps/web` and `apps/mobile` (via NativeWind).

## What Lives Here

- **Components** — `TaskRow`, `TaskCheckbox`, `PriorityBadge`, `SyncStatusIndicator`, etc.
- **Design tokens** — colors, spacing, typography (in `tokens.ts`)
- **Styling** — Tailwind/NativeWind classes (no platform-specific styles)

## Guidelines

**Component design:**
- Keep components **dumb** (accept props, don't fetch data)
- Props should be plain objects, not Supabase/PowerSync types
  - ✅ `<TaskRow task={{ title: "...", priority: 1 }} />`
  - ❌ Don't assume the `task` prop comes from PowerSync
- Compose components from smaller pieces; avoid deeply nested logic

**Styling:**
- Use Tailwind classes that work on both web and mobile (NativeWind v4 compatible)
- Check [`apps/mobile/package.json`](../../apps/mobile/package.json) for the pinned NativeWind version (currently `4.0.36`)
- Don't use web-only CSS features (e.g., `:hover` state on mobile)

**Imports:**
- ✅ Can import from `packages/core` (e.g., for utilities)
- ❌ Should NOT import from `packages/db` (queries stay in app layer)
- ❌ Should NOT import platform-specific modules (React Native `View` + React `div`)

## Platform Compatibility

Since this is shared by web and mobile:

**Web only:**
- Next.js/React specific: `useSearchParams`, `useRouter`, Suspense, Server Components
- Platform APIs: `window`, `document`, `fetch`

**Mobile only:**
- React Native: `View`, `ScrollView`, `FlatList`
- Expo APIs: `expo-camera`, `expo-location`

**If you need platform differences:**
Move the component to the app layer (`apps/web/components/` or `apps/mobile/src/components/`). Use `packages/ui` only for truly shared components.

## Example: Good vs. Bad

**Good — generic component:**
```typescript
// packages/ui/TaskRow.tsx
export function TaskRow({ task, onPress }) {
  return (
    <div className="flex items-center p-2">
      <input type="checkbox" onChange={onPress} />
      <span>{task.title}</span>
      <PriorityBadge priority={task.priority} />
    </div>
  );
}
```

**Bad — assumes PowerSync:**
```typescript
// ❌ Don't do this
import { useQuery } from '@powersync/react';
export function TaskRow({ taskId }) {
  const task = useQuery('SELECT * FROM tasks WHERE id = ?', [taskId]);
  // Now the component is tightly coupled to PowerSync + database shape
}
```

**Right pattern:**
```typescript
// apps/web/components/TaskList.tsx
import { getTasks } from '@todolist/db';
import { TaskRow } from '@todolist/ui';

export function TaskList() {
  const tasks = getTasks();
  return tasks.map(task => <TaskRow key={task.id} task={task} onPress={...} />);
}
```
