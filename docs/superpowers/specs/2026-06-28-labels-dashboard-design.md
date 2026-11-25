# Labels Dashboard

**Date:** 2026-06-28  
**Status:** Approved

## Goal

Mirror the Projects dashboard pattern for Labels: make the "Labels" sidebar heading a clickable link to a proper dashboard page where labels can be browsed and created. Remove the old `+ Manage labels` link from the sidebar.

## Changes

### 1. Sidebar (`apps/web/components/layout/Sidebar.tsx`)

- Convert the `<p>Labels</p>` heading to `<Link href="/labels">` using the same style as the existing "Projects" heading link.
- Remove the `+ Manage labels` anchor below the label list.

### 2. New query: `useLabelsWithStats` (`packages/db/src/queries/labels.ts`)

Add a reactive query that returns each label with its open task count:

```sql
SELECT
  l.id,
  l.name,
  l.color,
  (SELECT COUNT(*)
   FROM tasks t
   WHERE t.deleted_at IS NULL
     AND t.status NOT IN ('completed', 'cancelled')
     AND EXISTS (SELECT 1 FROM json_each(t.labels) WHERE value = l.name)
  ) AS open_tasks
FROM labels l
WHERE l.deleted_at IS NULL
ORDER BY l.name COLLATE NOCASE
```

Return type: `{ id: string; name: string; color: string | null; open_tasks: number }`.

No schema changes — this is a read-only derived query over existing tables.

### 3. Labels Dashboard page (`apps/web/app/labels/page.tsx`)

Replace the current form-based management page with a dashboard styled to match `/projects`:

**Header row:**
- Title: "Labels"
- Subtitle: `{N} labels · {M} open tasks` (summed from `useLabelsWithStats`)
- `+ New label` button (opens `CreateLabelModal`)

**Label list** (max-w-2xl, single column):

Each row (`bg-surface border border-border rounded-xl px-4 py-3`):
- Large color dot (clickable → toggles inline 8-swatch color picker row below)
- Label name as `<Link href="/labels/[name]">` (clicking navigates; separate pencil icon for rename)
- Open task count badge (e.g. `12 tasks`)
- Pencil icon: switches name to an inline `<input>` (blur → `updateLabel`)  
- Delete icon (✕): `confirm()` → `deleteLabel`

When the color dot is clicked, an 8-swatch row appears below that label row; clicking a swatch calls `updateLabel(db, id, { color })` and collapses the row.

**Empty state:** "No labels yet" + "Create your first label to get started."

### 4. Create Label Modal (`apps/web/components/labels/CreateLabelModal.tsx`)

New component (mirrors `CreateProjectModal` in structure, simpler fields):

- Name input (auto-focused, Enter submits)
- 8 color swatches (same palette as `SWATCHES` in current page: `#6366F1 #10B981 #EF4444 #F59E0B #3B82F6 #EC4899 #14B8A6 #8B5CF6`)
- Cancel / Create buttons
- Calls `createLabel(db, { userId, name, color })`
- Default color: `#6366F1`

## Out of Scope

- No changes to `/labels/[name]` (individual label task page) — unchanged.
- No schema migrations — labels table and sync rules are unchanged.
- No reordering / drag-and-drop.
