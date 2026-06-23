'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  useTask, useSubtasks,
  updateTaskTitle, updateTaskPriority, updateTaskProject,
  updateTaskDue, deleteTask, createTask, completeTask,
  updateTaskRecurrence,
} from '@todolist/db';
import { ProjectPicker } from '@/components/projects/ProjectPicker';
import { RecurrencePicker } from './RecurrencePicker';
import { DatePicker } from './DatePicker';
import { createClient } from '@/lib/supabase/client';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

interface Props {
  taskId:  string | null;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: Props) {
  const db             = usePowerSync();
  const { data: rows } = useTask(taskId ?? '');
  const { data: subs } = useSubtasks(taskId ?? '');
  const task           = rows?.[0];

  const [titleDraft,    setTitleDraft]    = useState('');
  const [editingTitle,  setEditingTitle]  = useState(false);
  const [newSubTitle,   setNewSubTitle]   = useState('');
  const [addingSub,     setAddingSub]     = useState(false);

  useEffect(() => {
    if (task) setTitleDraft(task.title ?? '');
  }, [task?.id, task?.title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveTitle = useCallback(async () => {
    if (!task || !titleDraft.trim()) return;
    setEditingTitle(false);
    if (titleDraft.trim() !== task.title) {
      await updateTaskTitle(db as any, task.id, titleDraft.trim());
    }
  }, [db, task, titleDraft]);

  const handlePriority = useCallback(async (p: number) => {
    if (!task) return;
    await updateTaskPriority(db as any, task.id, p);
  }, [db, task]);

  const handleProject = useCallback(async (projectId: string | null) => {
    if (!task) return;
    await updateTaskProject(db as any, task.id, projectId);
  }, [db, task]);

  const handleRecurrence = useCallback(async (rule: string | null) => {
    if (!task) return;
    const start = rule ? (task.due_date ?? new Date().toISOString().split('T')[0]) : null;
    await updateTaskRecurrence(db as any, task.id, rule, start);
  }, [db, task]);

  const handleDelete = useCallback(async () => {
    if (!task || !confirm('Delete this task?')) return;
    await deleteTask(db as any, task.id);
    onClose();
  }, [db, task, onClose]);

  const handleAddSub = useCallback(async () => {
    const title = newSubTitle.trim();
    if (!title || !task) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createTask(db as any, {
      userId: user.id, title, parentTaskId: task.id, status: 'active', priority: 4,
    });
    setNewSubTitle('');
  }, [db, task, newSubTitle]);

  const handleCompleteSub = useCallback(async (id: string) => {
    await completeTask(db as any, id);
  }, [db]);

  if (!taskId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 h-full w-[480px] bg-surface-alt border-l border-border z-40 flex flex-col shadow-2xl overflow-y-auto"
        role="complementary"
        aria-label="Task detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">Task</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors text-lg"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {!task ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">Loading…</p>
          </div>
        ) : (
          <div className="flex-1 p-6 space-y-6">
            {/* Title */}
            {editingTitle ? (
              <textarea
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } }}
                className="w-full bg-surface border border-accent rounded-xl px-4 py-3 text-text-primary text-lg font-semibold resize-none focus:outline-none"
                rows={2}
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="w-full text-left text-text-primary text-lg font-semibold hover:opacity-80 transition-opacity"
                aria-label="Edit task title"
              >
                {task.title}
              </button>
            )}

            {/* Priority */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Priority</p>
              <div className="flex gap-2">
                {([1, 2, 3, 4] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriority(p)}
                    aria-pressed={task.priority === p}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                    style={{
                      borderColor: PRIORITY_COLOR[p],
                      color:       task.priority === p ? '#fff' : PRIORITY_COLOR[p],
                      backgroundColor: task.priority === p ? PRIORITY_COLOR[p] : 'transparent',
                    }}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Due date</p>
              <DatePicker
                value={task.due_date ?? null}
                onChange={async (date) => {
                  await updateTaskDue(db as any, task.id, date, null);
                }}
              />
            </div>

            {/* Repeat */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Repeat</p>
              <RecurrencePicker value={task.recurrence_rule ?? null} onChange={handleRecurrence} />
            </div>

            {/* Project */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Project</p>
              <ProjectPicker value={task.project_id ?? null} onChange={handleProject} />
            </div>

            {/* Sub-tasks */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Sub-tasks</p>
              <div className="space-y-2">
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3">
                    <button
                      onClick={() => handleCompleteSub(sub.id)}
                      className="w-4 h-4 rounded-full border border-p4 flex-shrink-0 hover:bg-success/20 transition-colors"
                      aria-label={`Complete ${sub.title}`}
                    />
                    <span className={`text-sm flex-1 ${sub.status === 'completed' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>

              {addingSub ? (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    autoFocus
                    type="text"
                    value={newSubTitle}
                    onChange={e => setNewSubTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSub();
                      if (e.key === 'Escape') { setAddingSub(false); setNewSubTitle(''); }
                    }}
                    placeholder="Sub-task title"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent"
                  />
                  <button onClick={handleAddSub} className="text-accent text-sm font-medium">Add</button>
                  <button onClick={() => { setAddingSub(false); setNewSubTitle(''); }} className="text-text-muted text-sm">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSub(true)}
                  className="mt-2 text-accent text-sm hover:opacity-80 transition-opacity"
                >
                  + Add sub-task
                </button>
              )}
            </div>

            {/* Delete */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleDelete}
                className="w-full border border-error text-error rounded-xl py-2.5 text-sm font-medium hover:bg-error/10 transition-colors"
              >
                Delete task
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
