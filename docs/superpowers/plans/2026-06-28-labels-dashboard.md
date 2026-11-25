# Labels Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old form-based `/labels` management page with a proper dashboard matching the `/projects` pattern, with a clickable sidebar heading, inline color pickers, inline rename, and a `CreateLabelModal`.

**Architecture:** Add `useLabelsWithStats` query to `packages/db`, update the sidebar heading, create `CreateLabelModal`, then rewrite the labels page. State for inline color picker and rename lives in the page component itself — no new context or store needed.

**Tech Stack:** Next.js 14 App Router, PowerSync (`useQuery`), Vitest + Testing Library

---

## File Map

| Action | Path |
|--------|------|
| Modify | `packages/db/src/queries/labels.ts` |
| Modify | `apps/web/components/layout/Sidebar.tsx` |
| Create | `apps/web/components/labels/CreateLabelModal.tsx` |
| Rewrite | `apps/web/app/labels/page.tsx` |
| Create  | `apps/web/__tests__/CreateLabelModal.test.tsx` |
| Create  | `apps/web/__tests__/LabelsPage.test.tsx` |

---

### Task 1: Add `useLabelsWithStats` query

**Files:**
- Modify: `packages/db/src/queries/labels.ts`

- [ ] **Step 1: Add the type and hook after the existing `useLabels` export**

Open `packages/db/src/queries/labels.ts` and insert after line 10 (after the closing `}`  of `useLabels`):

```ts
export type LabelWithStats = {
  id: string;
  name: string;
  color: string | null;
  open_tasks: number;
};

export function useLabelsWithStats() {
  return useQuery<LabelWithStats>(
    `SELECT
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
     ORDER BY l.name COLLATE NOCASE`
  );
}
```

Note: `packages/db/src/index.ts` already uses `export * from './queries/labels'` so `useLabelsWithStats` and `LabelWithStats` are automatically exported — no index change needed.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors in `packages/db`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/queries/labels.ts
git commit -m "feat: add useLabelsWithStats reactive query"
```

---

### Task 2: Update Sidebar

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Convert Labels heading to a Link**

In `apps/web/components/layout/Sidebar.tsx`, replace (around line 135):

```tsx
<p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
  Labels
</p>
```

with:

```tsx
<Link
  href="/labels"
  className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors block"
>
  Labels
</Link>
```

- [ ] **Step 2: Remove the `+ Manage labels` link**

Still in `Sidebar.tsx`, delete these lines (around line 161–166):

```tsx
<Link
  href="/labels"
  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
>
  + Manage labels
</Link>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat: make Labels sidebar heading a link to /labels, remove manage-labels link"
```

---

### Task 3: CreateLabelModal — test first

**Files:**
- Create: `apps/web/__tests__/CreateLabelModal.test.tsx`
- Create: `apps/web/components/labels/CreateLabelModal.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/CreateLabelModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateLabelModal } from '@/components/labels/CreateLabelModal';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return { ...actual, createLabel: vi.fn().mockResolvedValue('new-label-id') };
});

import { createLabel } from '@todolist/db';

describe('CreateLabelModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not render when closed', () => {
    render(<CreateLabelModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with name input and color swatches when open', () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Label name')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Color #/i })).toHaveLength(8);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CreateLabelModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables Create when name is empty', () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Create')).toBeDisabled();
  });

  it('calls createLabel with name and color on submit', async () => {
    const onClose = vi.fn();
    render(<CreateLabelModal open={true} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Label name'), {
      target: { value: 'urgent' },
    });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(createLabel).toHaveBeenCalledWith(
      expect.anything(),
      { userId: 'user-1', name: 'urgent', color: '#6366F1' }
    ));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits on Enter key in name input', async () => {
    render(<CreateLabelModal open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Label name');
    fireEvent.change(input, { target: { value: 'work' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(createLabel).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run __tests__/CreateLabelModal.test.tsx
```

Expected: FAIL with "Cannot find module '@/components/labels/CreateLabelModal'"

- [ ] **Step 3: Create the component**

Create `apps/web/components/labels/CreateLabelModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { createLabel } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateLabelModal({ open, onClose }: Props) {
  const db = usePowerSync();
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await createLabel(db as any, { userId: user.id, name: name.trim(), color });
      setName('');
      setColor(SWATCHES[0]);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create label');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      role="dialog" aria-modal="true" aria-label="New label"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-surface-alt rounded-2xl p-6 shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-4">New label</h2>

        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
          Name
        </label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Label name"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
          Color
        </label>
        <div className="flex gap-2 mb-6">
          {SWATCHES.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-alt scale-110' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>

        {error && <p className="text-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-xl py-2.5 text-text-secondary text-sm hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="flex-[2] bg-accent text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run __tests__/CreateLabelModal.test.tsx
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/labels/CreateLabelModal.tsx apps/web/__tests__/CreateLabelModal.test.tsx
git commit -m "feat: add CreateLabelModal component"
```

---

### Task 4: Labels Dashboard page — test first

**Files:**
- Create: `apps/web/__tests__/LabelsPage.test.tsx`
- Rewrite: `apps/web/app/labels/page.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/LabelsPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LabelsPage from '@/app/labels/page';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useLabelsWithStats: vi.fn(),
    updateLabel: vi.fn().mockResolvedValue(undefined),
    deleteLabel: vi.fn().mockResolvedValue(undefined),
    createLabel: vi.fn().mockResolvedValue('new-id'),
  };
});

import { useLabelsWithStats, deleteLabel } from '@todolist/db';

const mockLabels = [
  { id: 'l1', name: 'work', color: '#6366F1', open_tasks: 5 },
  { id: 'l2', name: 'personal', color: '#10B981', open_tasks: 0 },
];

describe('LabelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLabelsWithStats as any).mockReturnValue({ data: mockLabels });
  });

  it('renders page title and subtitle with totals', () => {
    render(<LabelsPage />);
    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText(/2 labels/)).toBeInTheDocument();
    expect(screen.getByText(/5 open tasks/)).toBeInTheDocument();
  });

  it('renders a row for each label', () => {
    render(<LabelsPage />);
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('shows open task count badge on each row', () => {
    render(<LabelsPage />);
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
    expect(screen.getByText('0 tasks')).toBeInTheDocument();
  });

  it('shows empty state when no labels', () => {
    (useLabelsWithStats as any).mockReturnValue({ data: [] });
    render(<LabelsPage />);
    expect(screen.getByText('No labels yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first label to get started.')).toBeInTheDocument();
  });

  it('renders the + New label button', () => {
    render(<LabelsPage />);
    expect(screen.getByText('+ New label')).toBeInTheDocument();
  });

  it('calls deleteLabel after confirm on delete click', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<LabelsPage />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete work/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(deleteLabel).toHaveBeenCalledWith(expect.anything(), 'l1'));
    vi.unstubAllGlobals();
  });

  it('does not call deleteLabel when confirm returns false', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<LabelsPage />);
    const deleteButtons = screen.getAllByRole('button', { name: /Delete work/i });
    fireEvent.click(deleteButtons[0]);
    expect(deleteLabel).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run __tests__/LabelsPage.test.tsx
```

Expected: FAIL (current page exports `ManageLabelsPage`, not the new component).

- [ ] **Step 3: Rewrite the labels page**

Replace all content of `apps/web/app/labels/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePowerSync } from '@powersync/react';
import { useLabelsWithStats, updateLabel, deleteLabel } from '@todolist/db';
import { CreateLabelModal } from '@/components/labels/CreateLabelModal';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

export default function LabelsPage() {
  const db = usePowerSync();
  const { data: labels } = useLabelsWithStats();
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const totalTasks = labels.reduce((sum, l) => sum + l.open_tasks, 0);

  const handleRename = (id: string, newName: string, currentName: string) => {
    const trimmed = newName.trim().toLowerCase();
    if (trimmed && trimmed !== currentName) {
      updateLabel(db as any, id, { name: trimmed });
    }
    setEditingId(null);
  };

  const handleColorSelect = (id: string, color: string) => {
    updateLabel(db as any, id, { color });
    setColorPickerOpen(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete label "${name}"?`)) {
      deleteLabel(db as any, id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-text-primary text-2xl font-bold mb-1">Labels</h1>
          <p className="text-text-secondary text-sm">
            {labels.length} labels · {totalTasks} open tasks
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          + New label
        </button>
      </div>

      {/* Label list */}
      <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
        {labels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-text-primary font-semibold text-lg">No labels yet</p>
            <p className="text-text-muted text-sm">Create your first label to get started.</p>
          </div>
        ) : (
          <ul className="max-w-2xl space-y-2" role="list">
            {labels.map(label => (
              <li key={label.id}>
                <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  {/* Color dot */}
                  <button
                    onClick={() => setColorPickerOpen(colorPickerOpen === label.id ? null : label.id)}
                    className="w-4 h-4 rounded-full flex-shrink-0 hover:ring-2 hover:ring-white/50 transition-all"
                    style={{ backgroundColor: label.color ?? '#6366F1' }}
                    aria-label={`Change color for ${label.name}`}
                    aria-expanded={colorPickerOpen === label.id}
                  />

                  {/* Name — link or inline input */}
                  {editingId === label.id ? (
                    <input
                      autoFocus
                      defaultValue={label.name}
                      aria-label={`Rename ${label.name}`}
                      onBlur={e => handleRename(label.id, e.target.value, label.name)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-transparent text-text-primary text-sm focus:outline-none border-b border-accent"
                    />
                  ) : (
                    <Link
                      href={`/labels/${encodeURIComponent(label.name)}`}
                      className="flex-1 text-text-primary text-sm hover:text-accent transition-colors truncate"
                    >
                      {label.name}
                    </Link>
                  )}

                  {/* Open task count */}
                  <span className="text-xs text-text-muted bg-surface-alt px-2 py-0.5 rounded-full flex-shrink-0">
                    {label.open_tasks} tasks
                  </span>

                  {/* Pencil */}
                  <button
                    onClick={() => setEditingId(label.id)}
                    aria-label={`Rename ${label.name}`}
                    className="text-text-muted hover:text-text-secondary transition-colors text-sm flex-shrink-0"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(label.id, label.name)}
                    aria-label={`Delete ${label.name}`}
                    className="text-text-muted hover:text-error transition-colors text-sm flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Inline color picker */}
                {colorPickerOpen === label.id && (
                  <div className="mt-1 ml-4 flex gap-2 px-4 py-2 bg-surface border border-border rounded-xl max-w-fit">
                    {SWATCHES.map(c => (
                      <button
                        key={c}
                        onClick={() => handleColorSelect(label.id, c)}
                        className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${label.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-surface' : ''}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Set color ${c}`}
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateLabelModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run __tests__/LabelsPage.test.tsx
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass (some pre-existing skips are OK).

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/labels/page.tsx apps/web/__tests__/LabelsPage.test.tsx
git commit -m "feat: replace manage-labels page with labels dashboard"
```

---

### Task 5: Final build check

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: Build succeeds. If it fails on `useLabelsWithStats` not found, re-check that `packages/db/src/index.ts` still has `export * from './queries/labels'`.

- [ ] **Step 2: Commit if any build-only fixes needed**

```bash
git add -A
git commit -m "chore: fix build issues"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Sidebar Labels heading → Link to /labels | Task 2, Step 1 |
| Remove `+ Manage labels` link | Task 2, Step 2 |
| `useLabelsWithStats` query with open_tasks | Task 1 |
| Dashboard header: title + subtitle + New label button | Task 4 |
| Label row: color dot, name link, open task badge, pencil, delete | Task 4 |
| Color dot click → inline 8-swatch picker | Task 4 |
| Swatch click → `updateLabel(id, { color })` + close picker | Task 4 |
| Pencil → inline input, blur → `updateLabel` | Task 4 |
| Delete → `confirm()` → `deleteLabel` | Task 4 |
| Empty state message | Task 4 |
| `CreateLabelModal` with name + swatches + cancel/create | Task 3 |
| Default color `#6366F1` | Task 3, Step 3 |
| Enter submits modal | Task 3, Step 3 |

All spec requirements covered. No schema migrations needed (spec confirms read-only query).
