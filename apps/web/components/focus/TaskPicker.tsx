import type { FocusTask } from '@/lib/focus/FocusSessionContext';

interface Props {
  tasks:      FocusTask[];
  activeTask: FocusTask | null;
  onSelect:   (task: FocusTask) => void;
}

export function TaskPicker({ tasks, activeTask, onSelect }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="focus-mode-card">
        <p className="focus-mode-label">Current Task</p>
        <p className="focus-mode-empty">No tasks in focus — pin a task from Today</p>
      </div>
    );
  }

  return (
    <div className="focus-mode-card">
      <p className="focus-mode-label">Current Task</p>
      <select
        className="focus-mode-select"
        value={activeTask?.id ?? ''}
        onChange={e => {
          const task = tasks.find(t => t.id === e.target.value);
          if (task) onSelect(task);
        }}
      >
        <option value="" disabled>Select a task</option>
        {tasks.map(task => (
          <option key={task.id} value={task.id}>{task.title}</option>
        ))}
      </select>
    </div>
  );
}
