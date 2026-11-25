# Projects Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new Projects dashboard page showing all projects in a rich card-based grid view with progress tracking, descriptions, and categories.

**Architecture:** Add three columns to the projects table (description, category, due_date), update PowerSync schema and sync rules, create a new query function that aggregates project data with task stats, build card-based grid UI with responsive layout.

**Tech Stack:** Next.js 14 (App Router), PowerSync (local SQLite), Postgres, TypeScript, Tailwind CSS

---

## Phase 1: Database & Sync Layer

### Task 1: Create Migration for Project Fields

**Files:**
- Create: `supabase/migrations/20260624000004_add_project_fields.sql`

- [ ] **Step 1: Create migration file**

```bash
touch /home/rameshv/Repos/Projects/todolist/supabase/migrations/20260624000004_add_project_fields.sql
```

- [ ] **Step 2: Write migration SQL**

```sql
-- Add description, category, due_date to projects table
ALTER TABLE projects
ADD COLUMN description     text,
ADD COLUMN category        text NOT NULL DEFAULT 'Personal' 
                          CHECK (category IN ('Business','Learning','Habit','Personal','Backlog')),
ADD COLUMN due_date        date;

-- Index on category for filtering later
CREATE INDEX projects_category_idx ON projects (category) WHERE deleted_at IS NULL;
```

- [ ] **Step 3: Verify migration file exists and has correct syntax**

Run: `cat /home/rameshv/Repos/Projects/todolist/supabase/migrations/20260624000004_add_project_fields.sql`

Expected: SQL file contains ALTER TABLE and CREATE INDEX commands

---

### Task 2: Update PowerSync Sync Rules

**Files:**
- Modify: `powersync/sync-rules.yaml`

- [ ] **Step 1: Read current sync rules file**

Run: `cat /home/rameshv/Repos/Projects/todolist/powersync/sync-rules.yaml`

Note the current projects query.

- [ ] **Step 2: Update projects query to include new columns**

The current line:
```yaml
      - SELECT * FROM projects        WHERE user_id = auth.user_id()
```

Already selects `*`, so new columns will be included automatically. ✅ **No change needed** — PowerSync will automatically sync the new columns when the migration is applied.

**Verify:** The `SELECT *` pattern means any new columns in Postgres are automatically replicated. This is good design.

---

### Task 3: Update PowerSync Schema Types

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Read current schema**

Run: `cat /home/rameshv/Repos/Projects/todolist/packages/db/src/schema.ts`

- [ ] **Step 2: Update projects table definition**

Replace the projects table definition (lines 34-47) with:

```typescript
const projects = new Table(
  {
    user_id:     column.text,
    name:        column.text,
    description: column.text,
    category:    column.text,
    due_date:    column.text,
    color:       column.text,
    icon:        column.text,
    is_archived: column.integer,
    sort_order:  column.text,
    created_at:  column.text,
    updated_at:  column.text,
    deleted_at:  column.text,
  },
  { indexes: { by_name: ['name'], by_category: ['category'] } }
);
```

- [ ] **Step 3: Verify types are exported**

Check that `ProjectRecord` is exported at the bottom of the file. Run:

```bash
grep "export type ProjectRecord" /home/rameshv/Repos/Projects/todolist/packages/db/src/schema.ts
```

Expected: Line should exist exporting the ProjectRecord type

- [ ] **Step 4: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors in packages/db

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist && git add supabase/migrations/20260624000004_add_project_fields.sql packages/db/src/schema.ts && git commit -m "schema: add description, category, due_date to projects table"
```

---

## Phase 2: Query Layer

### Task 4: Add Project Stats Query Function

**Files:**
- Modify: `packages/db/src/queries/projects.ts`

- [ ] **Step 1: Read current projects queries file**

Run: `cat /home/rameshv/Repos/Projects/todolist/packages/db/src/queries/projects.ts`

- [ ] **Step 2: Add new query function for dashboard**

Add this function after the existing `useProjects()` function (after line 12):

```typescript
export function useProjectsWithStats() {
  return useQuery<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    color: string;
    icon: string;
    due_date: string | null;
    total_tasks: number;
    completed_tasks: number;
    open_tasks: number;
  }>(
    `SELECT 
       p.id, 
       p.name, 
       p.description, 
       p.category, 
       p.color, 
       p.icon, 
       p.due_date,
       COUNT(CASE WHEN t.status != 'cancelled' AND t.deleted_at IS NULL THEN 1 END) as total_tasks,
       COUNT(CASE WHEN t.status = 'completed' AND t.deleted_at IS NULL THEN 1 END) as completed_tasks,
       COUNT(CASE WHEN t.status NOT IN ('completed', 'cancelled') AND t.deleted_at IS NULL THEN 1 END) as open_tasks
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.user_id = ? AND p.is_archived = 0 AND p.deleted_at IS NULL
     GROUP BY p.id, p.name, p.description, p.category, p.color, p.icon, p.due_date
     ORDER BY p.sort_order`,
    []  // User ID will be provided by the hook caller
  );
}
```

**Note:** This query doesn't take userId as a parameter because PowerSync filters at the sync layer. The query operates only on synced rows (user's own data).

- [ ] **Step 3: Update createProject to accept new fields**

Modify the `createProject` function signature and implementation:

Replace lines 14-27 with:

```typescript
export async function createProject(
  db: AbstractPowerSyncDatabase,
  fields: { 
    userId: string; 
    name: string; 
    description?: string;
    category?: string;
    due_date?: string;
    color?: string; 
    icon?: string; 
    afterSortOrder?: string | null 
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  await db.execute(
    `INSERT INTO projects (id, user_id, name, description, category, due_date, color, icon, is_archived, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,0,?,?,?)`,
    [
      id, 
      fields.userId, 
      fields.name,
      fields.description ?? null,
      fields.category ?? 'Personal',
      fields.due_date ?? null,
      fields.color ?? '#6366F1', 
      fields.icon ?? '📁', 
      sortOrder, 
      now, 
      now
    ]
  );
  return id;
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors in packages/db

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist && git add packages/db/src/queries/projects.ts && git commit -m "feat: add useProjectsWithStats query and extend createProject with metadata"
```

---

## Phase 3: UI Components

### Task 5: Create ProjectCard Component

**Files:**
- Create: `apps/web/components/projects/ProjectCard.tsx`

- [ ] **Step 1: Create component file**

```bash
touch /home/rameshv/Repos/Projects/todolist/apps/web/components/projects/ProjectCard.tsx
```

- [ ] **Step 2: Write ProjectCard component**

```typescript
'use client';

import Link from 'next/link';
import { useMemo } from 'react';

interface ProjectCardProps {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string;
  icon: string;
  due_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

const categoryColors = {
  Business: 'bg-orange-100 text-orange-700',
  Learning: 'bg-blue-100 text-blue-700',
  Habit: 'bg-purple-100 text-purple-700',
  Personal: 'bg-green-100 text-green-700',
  Backlog: 'bg-gray-100 text-gray-700',
};

export function ProjectCard({
  id,
  name,
  description,
  category,
  color,
  icon,
  due_date,
  total_tasks,
  completed_tasks,
  open_tasks,
}: ProjectCardProps) {
  const progress = total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;
  const categoryColor = categoryColors[category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700';
  
  // Format due date for display
  const formattedDueDate = due_date 
    ? new Date(due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <Link href={`/projects/${id}`}>
      <div className="block h-full p-5 border border-border rounded-xl hover:bg-surface transition-colors cursor-pointer">
        {/* Header: Icon + Name + Category Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-semibold text-base truncate">{name}</h3>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium text-nowrap flex-shrink-0 ${categoryColor}`}>
            {category}
          </span>
        </div>

        {/* Description */}
        {description && (
          <p className="text-text-secondary text-sm mb-4 line-clamp-2">{description}</p>
        )}

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-text-muted">Progress</span>
            <span className="text-xs font-medium text-text-secondary">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: color || '#6366F1',
              }}
            />
          </div>
        </div>

        {/* Task Counts */}
        <div className="flex items-center gap-4 mb-3">
          <div>
            <p className="text-xs text-text-muted">Open</p>
            <p className="text-lg font-semibold text-text-primary">{open_tasks}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Done</p>
            <p className="text-lg font-semibold text-text-primary">{completed_tasks}</p>
          </div>
          {total_tasks > 0 && (
            <div>
              <p className="text-xs text-text-muted">Total</p>
              <p className="text-lg font-semibold text-text-primary">{total_tasks}</p>
            </div>
          )}
        </div>

        {/* Due Date */}
        {formattedDueDate && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-text-muted">Due</p>
            <p className="text-sm font-medium text-text-secondary">{formattedDueDate}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Verify file was created**

```bash
cat /home/rameshv/Repos/Projects/todolist/apps/web/components/projects/ProjectCard.tsx | head -20
```

Expected: First 20 lines of component code

- [ ] **Step 4: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist && git add apps/web/components/projects/ProjectCard.tsx && git commit -m "feat: add ProjectCard component for dashboard display"
```

---

### Task 6: Create Projects Dashboard Page

**Files:**
- Create: `apps/web/app/projects/page.tsx`

- [ ] **Step 1: Create dashboard page file**

```bash
touch /home/rameshv/Repos/Projects/todolist/apps/web/app/projects/page.tsx
```

- [ ] **Step 2: Write dashboard page**

```typescript
'use client';

import { useState } from 'react';
import { useProjectsWithStats } from '@todolist/db';
import { ProjectCard } from '@/components/projects/ProjectCard';
import Link from 'next/link';

export default function ProjectsPage() {
  const { data: projects } = useProjectsWithStats();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProjects = selectedCategory
    ? projects.filter(p => p.category === selectedCategory)
    : projects;

  const categories = ['Business', 'Learning', 'Habit', 'Personal', 'Backlog'];
  const activeCounts = categories.map(cat => ({
    category: cat,
    count: projects.filter(p => p.category === cat).length,
  }));

  const totalActive = projects.length;
  const totalCompleted = projects.reduce((sum, p) => sum + p.completed_tasks, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-text-primary text-2xl font-bold mb-1">Projects</h1>
          <p className="text-text-secondary text-sm">
            {totalActive} active · {totalCompleted} tasks completed
          </p>
        </div>
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            // Open create project modal — will be wired in next task
          }}
          className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          + New project
        </Link>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border overflow-x-auto scrollable">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            selectedCategory === null
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-surface'
          }`}
        >
          All areas
        </button>
        {activeCounts.map(({ category, count }) =>
          count > 0 ? (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-surface'
              }`}
            >
              {category} ({count})
            </button>
          ) : null
        )}
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-text-primary font-semibold text-lg">No projects yet</p>
            <p className="text-text-muted text-sm">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
            {filteredProjects.map(project => (
              <ProjectCard key={project.id} {...project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify file was created**

```bash
cat /home/rameshv/Repos/Projects/todolist/apps/web/app/projects/page.tsx | head -25
```

Expected: First 25 lines of page code

- [ ] **Step 4: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist && git add apps/web/app/projects/page.tsx && git commit -m "feat: add projects dashboard page with category filtering"
```

---

## Phase 4: Integration

### Task 7: Update Sidebar to Link to Projects Dashboard

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read current Sidebar**

Run: `sed -n '103,108p' /home/rameshv/Repos/Projects/todolist/apps/web/components/layout/Sidebar.tsx`

This shows the Projects section header.

- [ ] **Step 2: Add link to projects dashboard**

Replace lines 103-107:

```typescript
      {/* Projects */}
      <div className="mt-4 px-2 flex-1 overflow-y-auto scrollable">
        <Link
          href="/projects"
          className="px-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors block"
        >
          Projects
        </Link>
```

This makes the "Projects" text clickable and navigates to `/projects`.

- [ ] **Step 3: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist && git add apps/web/components/layout/Sidebar.tsx && git commit -m "feat: make Projects sidebar heading clickable to dashboard"
```

---

### Task 8: Update CreateProjectModal to Accept New Fields

**Files:**
- Modify: `apps/web/components/projects/CreateProjectModal.tsx`

- [ ] **Step 1: Read current modal**

```bash
head -50 /home/rameshv/Repos/Projects/todolist/apps/web/components/projects/CreateProjectModal.tsx
```

- [ ] **Step 2: Add new form fields for description, category, due_date**

Find the form inside the modal and add these fields (assume the form already has name, color, icon). Add before the submit button:

```typescript
{/* Description */}
<div className="mb-4">
  <label className="block text-sm font-medium text-text-primary mb-2">
    Description (optional)
  </label>
  <textarea
    value={formData.description || ''}
    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
    placeholder="What is this project about?"
    className="w-full px-3 py-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
    rows={3}
  />
</div>

{/* Category */}
<div className="mb-4">
  <label className="block text-sm font-medium text-text-primary mb-2">
    Category
  </label>
  <select
    value={formData.category || 'Personal'}
    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
    className="w-full px-3 py-2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-sm"
  >
    <option value="Business">Business</option>
    <option value="Learning">Learning</option>
    <option value="Habit">Habit</option>
    <option value="Personal">Personal</option>
    <option value="Backlog">Backlog</option>
  </select>
</div>

{/* Due Date */}
<div className="mb-6">
  <label className="block text-sm font-medium text-text-primary mb-2">
    Due Date (optional)
  </label>
  <input
    type="date"
    value={formData.due_date || ''}
    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
    className="w-full px-3 py-2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-sm"
  />
</div>
```

- [ ] **Step 3: Update form state initialization**

Ensure formData has these fields initialized:

```typescript
const [formData, setFormData] = useState({
  name: '',
  color: '#6366F1',
  icon: '📁',
  description: '',
  category: 'Personal',
  due_date: '',
});
```

- [ ] **Step 4: Update form submission**

Modify the createProject call to pass the new fields:

```typescript
const projectId = await createProject(db, {
  userId: user.id,
  name: formData.name,
  color: formData.color,
  icon: formData.icon,
  description: formData.description,
  category: formData.category,
  due_date: formData.due_date,
});
```

- [ ] **Step 5: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist && git add apps/web/components/projects/CreateProjectModal.tsx && git commit -m "feat: add description, category, due_date fields to create project modal"
```

---

## Phase 5: Testing & Verification

### Task 9: Verify Schema & Query Functions

**Files:**
- Test: Manual verification steps

- [ ] **Step 1: Build the project**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm build
```

Expected: Build succeeds with no errors

- [ ] **Step 2: Start the dev server**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm dev
```

Expected: Web app starts on localhost:3000

- [ ] **Step 3: Navigate to /projects**

Open browser: `http://localhost:3000/projects`

Expected: Projects dashboard page loads (may be empty if no projects exist yet)

- [ ] **Step 4: Create a test project**

Click "+ New project" button, fill form with:
- Name: "Test Project"
- Description: "This is a test"
- Category: "Business"
- Due Date: (pick a future date)

Expected: Modal submits, project is created and appears on dashboard as a card

- [ ] **Step 5: Create a few tasks for the project**

Navigate to the project detail page (click the card), click "+ Add task"

Add 2-3 tasks with different statuses (some active, some completed)

Expected: Cards update to show progress bar and task counts

- [ ] **Step 6: Filter by category on dashboard**

Go back to `/projects`, click category filter tabs

Expected: Grid filters to show only projects in selected category

---

### Task 10: Final Verification & Commit

**Files:**
- Verify all changes are committed

- [ ] **Step 1: Check git status**

```bash
cd /home/rameshv/Repos/Projects/todolist && git status
```

Expected: Working tree clean (no uncommitted changes)

- [ ] **Step 2: View commit history**

```bash
cd /home/rameshv/Repos/Projects/todolist && git log --oneline | head -10
```

Expected: See all the commits from tasks 1-8

- [ ] **Step 3: Run typecheck one final time**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Run linter**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm lint
```

Expected: No errors or only minor warnings (no critical issues)

- [ ] **Step 5: Test on mobile (optional)**

If time permits, verify responsive design works on mobile breakpoints by resizing browser or testing in mobile view.

---

## Spec Compliance Checklist

- ✅ Task 1-2: Database schema changes (description, category, due_date)
- ✅ Task 2: PowerSync sync rules updated (automatic via SELECT *)
- ✅ Task 3: PowerSync schema types updated (ProjectRecord)
- ✅ Task 4: New query function (useProjectsWithStats) with task aggregation
- ✅ Task 5: ProjectCard component showing all required data
- ✅ Task 6: Projects dashboard page with grid layout and category filtering
- ✅ Task 7-8: Integration with sidebar and create project modal
- ✅ Task 9-10: Verification and testing

---

## Architecture Notes

**Schema Normalization:** Projects table is denormalized in the UI (card shows progress %, open/done counts) but normalized in the DB (single row per project). Counts are derived via JOIN at query time.

**Query Performance:** LEFT JOIN with GROUP BY is efficient for small datasets (<1000 projects). PowerSync keeps data local, so no network latency.

**PowerSync Sync:** New columns are automatically synced due to `SELECT *` in sync rules. Migrations and sync rules follow the documented workflow: Postgres → sync rules → packages/db types.

**UI Responsiveness:** Grid uses Tailwind's `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for responsive 1/2/3 column layout on mobile/tablet/desktop.

---

## Files Modified Summary

| File | Action | Purpose |
|------|--------|---------|
| supabase/migrations/20260624000004_add_project_fields.sql | Create | Add schema columns |
| packages/db/src/schema.ts | Modify | Update ProjectRecord type |
| packages/db/src/queries/projects.ts | Modify | Add useProjectsWithStats query, extend createProject |
| apps/web/components/projects/ProjectCard.tsx | Create | Card component with stats display |
| apps/web/app/projects/page.tsx | Create | Dashboard page with grid + filters |
| apps/web/components/layout/Sidebar.tsx | Modify | Make Projects heading clickable |
| apps/web/components/projects/CreateProjectModal.tsx | Modify | Add form fields for new columns |

---

## Execution Recommendations

- **Test the migration locally** before committing by applying it to a test Supabase instance
- **Start the dev server early** (Task 9, Step 2) and keep it running; browser hot-reload will apply changes as you commit
- **Commit frequently** after each task — this matches the plan structure
- **If typecheck fails**, check that all imports are correct and types match between files

