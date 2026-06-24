'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  useTodayTasks, useTodayStats, useProjects, completeTask, toggleFocus,
} from '@todolist/db';
import { useViewMode } from '@/hooks/useViewMode';
import { ViewToggle } from '@/components/today/ViewToggle';
import { BoardView } from '@/components/today/BoardView';
import { FocusSessionProvider } from '@/lib/focus/FocusSessionContext';
import { TaskRow } from '@/components/tasks/TaskRow';
import { FocusTaskCard } from '@/components/today/FocusTaskCard';
import { RightPanel } from '@/components/today/RightPanel';
import { FocusSessionCard } from '@/components/today/FocusSessionCard';
import { TodayProgressCard } from '@/components/today/TodayProgressCard';
import { WeeklyActivityCard } from '@/components/today/WeeklyActivityCard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';

export default function TodayPage() {
  const db                  = usePowerSync();
  const { data: tasks }     = useTodayTasks();
  const { data: statsRows } = useTodayStats();
  const { data: projects }  = useProjects();
  const { mode, setMode, mounted } = useViewMode();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats     = statsRows[0] ?? { total: 0, completed: 0 };
  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  const focusTasks = tasks.filter(t => t.in_focus === 1);
  const laterTasks = tasks.filter(t => t.in_focus !== 1);

  const today   = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleComplete    = async (id: string) => { await completeTask(db as any, id); };
  const handleToggleFocus = async (id: string) => { await toggleFocus(db as any, id); };

  if (!mounted) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  return (
    <FocusSessionProvider>
      <div className="flex h-full">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto scrollable">
          {/* Header with view toggle */}
          <div className="px-6 pt-8 pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-text-primary text-3xl font-bold">Today</h1>
              <p className="text-text-muted text-sm mt-1">
                {dateStr} · {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {focusTasks.length} in focus
              </p>
            </div>
            <ViewToggle mode={mode as 'list' | 'board'} setMode={setMode as any} />
          </div>

          {/* Render based on view mode */}
          {mode === 'board' ? (
            <BoardView
              tasks={tasks.map(t => ({
                ...t,
                priority: (t.priority ?? 4) as number,
                in_focus: (t.in_focus ?? 0) as number,
              }))}
              projects={projects.map(p => ({
                id: p.id,
                name: p.name ?? '',
                color: p.color ?? '#808080',
              }))}
              onTaskDetail={setDetailId}
              onAddTask={() => setCapture(true)}
            />
          ) : (
            <>
              {/* Add task bar */}
              <div className="px-6 pb-4">
                <button
                  onClick={() => setCapture(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border text-text-muted text-sm hover:border-accent/40 hover:bg-surface transition-colors text-left"
                >
                  <span>+</span>
                  <span>Add a task — try "Draft update Fri 9am #project !high"</span>
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2">
                  <p className="text-text-primary font-semibold text-lg">All done for today 🎉</p>
                  <p className="text-text-muted text-sm">Nothing due today or overdue</p>
                </div>
              ) : (
                <>
                  {/* IN FOCUS */}
                  {focusTasks.length > 0 && (
                    <section className="px-6 pb-4" aria-labelledby="section-in-focus">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
                        <h2 id="section-in-focus" className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                          In Focus
                        </h2>
                      </div>
                      <div className="flex flex-col gap-2">
                        {focusTasks.map(task => {
                          const proj = projectOf(task.project_id);
                          return (
                            <FocusTaskCard
                              key={task.id}
                              task={{
                                ...task,
                                project_name:  proj?.name  ?? null,
                                project_color: proj?.color ?? null,
                              }}
                              onPress={setDetailId}
                              onComplete={handleComplete}
                              onToggleFocus={handleToggleFocus}
                            />
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* LATER TODAY */}
                  {laterTasks.length > 0 && (
                    <section className="px-6 pb-4" aria-labelledby="section-later">
                      <h2 id="section-later" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                        Later Today
                      </h2>
                      <div role="list" className="space-y-2 px-0">
                        {laterTasks.map(task => (
                          <div key={task.id} className="group relative">
                            <div className="absolute right-3 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                onClick={() => handleToggleFocus(task.id)}
                                className="text-text-muted hover:text-text-primary flex-shrink-0 text-sm focus:outline-none"
                                aria-label={`Add ${task.title} to focus`}
                                title="Add to focus"
                              >
                                📌
                              </button>
                            </div>
                            <TaskRow
                              task={task as any}
                              onPress={setDetailId}
                              onComplete={handleComplete}
                              draggable={true}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        <RightPanel>
          <FocusSessionCard focusTasks={focusTasks.filter(t => t.title).map(t => ({ id: t.id, title: t.title! }))} />
          <TodayProgressCard completed={stats.completed} total={stats.total} />
          <WeeklyActivityCard />
        </RightPanel>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </FocusSessionProvider>
  );
}
