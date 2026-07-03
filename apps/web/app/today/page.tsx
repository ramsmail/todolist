'use client';

import { useState } from 'react';
import { useTodayTasks, useTodayStats, useProjects } from '@todolist/db';
import { FocusSessionProvider, useFocusSession } from '@/lib/focus/FocusSessionContext';
import { IvyLeeList } from '@/components/today/IvyLeeList';
import { LaterTodaySection } from '@/components/today/LaterTodaySection';
import { TodayStatsRow } from '@/components/today/TodayStatsRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';

const POMODORO = 25 * 60;

function TodayContent() {
  const { data: tasks }     = useTodayTasks();
  const { data: statsRows } = useTodayStats();
  const { data: projects }  = useProjects();
  const { isRunning, secondsLeft, start, pause } = useFocusSession();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rawStats = statsRows[0];
  const stats = { total: rawStats?.total ?? 0, completed: rawStats?.completed ?? 0 };
  const focusTasks = tasks.filter(t => t.in_focus === 1);
  const laterTasks = tasks.filter(t => t.in_focus !== 1);
  const focusSeconds = POMODORO - secondsLeft;

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleStartFocus = () => {
    if (isRunning) {
      pause();
    } else {
      start(focusTasks.filter(t => t.title).map(t => ({ id: t.id, title: t.title! })));
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dateStr}</p>
        </div>

        <IvyLeeList
          tasks={focusTasks}
          projects={projects}
          onOpenDetail={setDetailId}
        />

        <LaterTodaySection
          tasks={laterTasks}
          projects={projects}
          focusTasks={focusTasks}
        />

        <TodayStatsRow
          total={stats.total}
          completed={stats.completed}
          focusSeconds={focusSeconds}
        />

        <button
          onClick={handleStartFocus}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors"
        >
          <span aria-hidden="true">⚡</span>
          <span>{isRunning ? 'Pause Focus Session' : 'Start Focus Session'}</span>
        </button>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </>
  );
}

export default function TodayPage() {
  return (
    <FocusSessionProvider>
      <TodayContent />
    </FocusSessionProvider>
  );
}
