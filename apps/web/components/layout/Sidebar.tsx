'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProjects, useLabels, useSavedFilters, useTodayTasks, useInboxTasks, useStreak } from '@todolist/db';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';

const SYNC_DOT: Record<string, string> = {
  synced:  'bg-success',
  syncing: 'bg-accent animate-pulse',
  stale:   'bg-warning',
  offline: 'bg-error',
};

const NAV = [
  { href: '/today',    label: 'Today',     countKey: 'today'    },
  { href: '/inbox',    label: 'Inbox',     countKey: 'inbox'    },
  { href: '/upcoming', label: 'Upcoming',  countKey: null       },
  { href: '/logbook',  label: 'Logbook',   countKey: null       },
  { href: '/all',      label: 'All tasks', countKey: null       },
];

interface Props {
  onNewProject:  () => void;
  onQuickCapture: () => void;
}

export function Sidebar({ onNewProject, onQuickCapture }: Props) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { status }              = useSyncStatus();
  const { data: projects }      = useProjects();
  const { data: labels }        = useLabels();
  const { userId }              = useCurrentUser();
  const { data: savedFilters }  = useSavedFilters(userId ?? '');
  const { data: todayTasks }    = useTodayTasks();
  const { data: inboxTasks }    = useInboxTasks();
  const { count: streakCount, days: streakDays } = useStreak();
  const [signingOut, setSigningOut] = useState(false);
  const [filterModal, setFilterModal] = useState<{ open: boolean; filter?: any }>({ open: false });

  const counts: Record<string, number> = {
    today: todayTasks.length,
    inbox: inboxTasks.length,
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav
      className="w-60 flex-shrink-0 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0"
      aria-label="Main navigation"
    >
      {/* Header: app name + sync dot */}
      <div className="px-4 py-5 border-b border-border flex items-center gap-2">
        <span className="text-text-primary font-bold text-lg tracking-tight">TodoList</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SYNC_DOT[status]}`} aria-hidden="true" />
      </div>

      {/* Quick Add */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onQuickCapture}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm font-semibold transition-colors"
        >
          + Quick add
        </button>
      </div>

      {/* Core nav */}
      <ul className="mt-1 space-y-0.5 px-2" role="list">
        {NAV.map(({ href, label, countKey }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          const count = countKey ? counts[countKey] : null;
          return (
            <li key={href + label}>
              <Link
                href={href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? 'bg-surface text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                aria-current={active ? 'page' : undefined}
              >
                <span>{label}</span>
                {count != null && count > 0 && (
                  <span className="text-xs text-text-muted bg-surface-alt px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Projects + Labels + Filters */}
      <div className="mt-4 px-2 flex-1 overflow-y-auto">
        <p className="px-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Projects</p>
        <ul className="space-y-0.5" role="list">
          {projects.map(p => {
            const active = pathname === `/projects/${p.id}`;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color ?? '#6366F1' }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{p.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + New project
        </button>

        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Labels</p>
        <ul className="space-y-0.5" role="list">
          {labels.filter(l => l.name).map(l => {
            const active = pathname === `/labels/${encodeURIComponent(l.name as string)}`;
            return (
              <li key={l.id}>
                <Link
                  href={`/labels/${encodeURIComponent(l.name as string)}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: l.color ?? '#6366F1' }} aria-hidden="true" />
                  <span className="truncate">{l.name as string}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/labels"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + Manage labels
        </Link>

        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Filters</p>
        <ul className="space-y-0.5" role="list">
          {savedFilters.map(f => {
            const active = pathname === `/filters/${f.id}`;
            return (
              <li key={f.id as string}>
                <Link
                  href={`/filters/${f.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span aria-hidden="true">{(f.icon as string) || '⊟'}</span>
                  <span className="truncate">{f.name as string}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={() => setFilterModal({ open: true })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + New filter
        </button>
      </div>

      {/* Daily Streak */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-text-muted mb-1">Daily streak</p>
        <p className="text-text-primary font-bold text-lg leading-none">
          {streakCount} <span className="text-sm font-normal text-text-muted">days</span>
        </p>
        <div className="flex gap-1 mt-2" aria-label={`${streakCount} day streak`}>
          {streakDays.map((met, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full ${met ? 'bg-accent' : 'bg-surface-alt border border-border'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="border-t border-border pb-2">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-left px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          Sign out
        </button>
      </div>

      <FilterBuilderModal
        open={filterModal.open}
        onClose={() => setFilterModal({ open: false })}
        filter={filterModal.filter}
      />
    </nav>
  );
}
