'use client';

import { useRef } from 'react';
import { useTodayTasks } from '@thinkdo/db';
import {
  useFocusSession, FOCUS_SECONDS, SHORT_BREAK_SECONDS, LONG_BREAK_SECONDS, type FocusPhase,
} from '@/lib/focus/FocusSessionContext';
import { TaskPicker } from '@/components/focus/TaskPicker';
import { FocusRing } from '@/components/focus/FocusRing';
import { FocusControls } from '@/components/focus/FocusControls';
import { RoundIndicator } from '@/components/focus/RoundIndicator';
import { ImmersiveToggle } from '@/components/focus/ImmersiveToggle';

function totalSecondsFor(phase: FocusPhase): number {
  if (phase === 'shortBreak') return SHORT_BREAK_SECONDS;
  if (phase === 'longBreak')  return LONG_BREAK_SECONDS;
  return FOCUS_SECONDS;
}

export default function FocusPage() {
  const { data: tasks } = useTodayTasks();
  const focusTasks = tasks
    .filter((t: any) => t.in_focus === 1 && t.title)
    .map((t: any) => ({ id: t.id as string, title: t.title as string }));

  const {
    phase, round, secondsLeft, isRunning, activeTask, selectTask, start, pause, reset, skip,
  } = useFocusSession();

  const containerRef = useRef<HTMLDivElement>(null);
  const totalSeconds = totalSecondsFor(phase);

  return (
    <div ref={containerRef} className="focus-mode-page">
      <div className="focus-mode-header">
        <h1>Focus Mode</h1>
        <p>Select a task and enter deep work</p>
      </div>

      <TaskPicker tasks={focusTasks} activeTask={activeTask} onSelect={selectTask} />

      <FocusRing phase={phase} secondsLeft={secondsLeft} totalSeconds={totalSeconds} />

      <FocusControls
        isRunning={isRunning}
        canStart={Boolean(activeTask)}
        onPlayPause={() => (isRunning ? pause() : start())}
        onReset={reset}
        onSkip={skip}
      />

      <RoundIndicator round={round} durationMinutes={totalSeconds / 60} />

      <ImmersiveToggle targetRef={containerRef} />
    </div>
  );
}
