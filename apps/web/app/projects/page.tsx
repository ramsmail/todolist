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
