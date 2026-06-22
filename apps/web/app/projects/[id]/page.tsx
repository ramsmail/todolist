'use client';

import { useState } from 'react';
import { use } from 'react';
import { usePowerSync } from '@powersync/react';
import { useProjectTasks, useProjects, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }            = use(params);
  const db                = usePowerSync();
  const { data: tasks }   = useProjectTasks(id);
  const { data: projects} = useProjects();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const project = projects.find(p => p.id === id);
  const handleComplete = async (taskId: string) => { await completeTask(db as any, taskId); };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            {project && (
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
            )}
            <h1 className="text-text-primary text-xl font-bold">
              {project?.name ?? 'Project'}
            </h1>
          </div>
          <button
            onClick={() => setCapture(true)}
            className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
          >
            + Add task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-text-primary font-semibold text-lg">No tasks yet</p>
            <p className="text-text-muted text-sm">Add the first task to this project</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TaskList tasks={tasks as any} onPress={setDetailId} onComplete={handleComplete} />
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} projectId={id} onClose={() => setCapture(false)} />
    </div>
  );
}
