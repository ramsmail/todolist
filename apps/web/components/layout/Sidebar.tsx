'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProjects, useLabels, useSavedFilters, useInboxTasks, useTodayTasks } from '@todolist/db';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';

const NAV = [
  { href: '/inbox',    label: 'Inbox',    icon: '📥' },
  { href: '/today',    label: 'Today',    icon: '☀️' },
  { href: '/upcoming', label: 'Upcoming', icon: '📅' },
  { href: '/logbook',  label: 'Logbook',  icon: '✓' },
  { href: '/search',   label: 'Search',   icon: '🔍' },
];

interface Props {
  onQuickAdd: () => void;
}

export function Sidebar({ onQuickAdd }: Props) {
  const pathname        = usePathname();
  const router          = useRouter();
  const { data: inboxTasks, count: inboxCount } = useInboxTasks();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const { userId } = useCurrentUser();
  const { data: todayTasks, count: todayCount } = useTodayTasks();
  const { data: savedFilters } = useSavedFilters(userId ?? '');
  const [signingOut, setSigningOut] = useState(false);
  const [filterModal, setFilterModal] = useState<{ open: boolean; filter?: any }>({ open: false });

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
      {/* App name */}
      <div className="px-4 py-5 border-b border-border">
        <span className="text-text-primary font-bold text-lg tracking-tight">TodoList</span>
      </div>

      {/* Quick add */}
      <div className="px-2 mt-3">
        <button
          onClick={onQuickAdd}
          className="w-full flex items-center gap-2 bg-accent text-white font-semibold rounded-xl px-3 py-2.5 text-sm hover:bg-accent-dark transition-colors"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Quick add
        </button>
      </div>

      {/* Core nav */}
      <ul className="mt-2 space-y-0.5 px-2" role="list">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          let count: number | null = null;

          if (label === 'Today') count = todayCount;
          if (label === 'Inbox') count = inboxCount;

          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? 'bg-surface text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                  }`}
                aria-current={active ? 'page' : undefined}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
                {count !== null && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                    count > 0
                      ? 'bg-accent text-white'
                      : 'bg-gray-300 text-gray-500 opacity-50'
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Projects */}
      <div className="mt-4 px-2 flex-1 overflow-y-auto scrollable">
        <Link
          href="/projects"
          className="px-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors block"
        >
          Projects
        </Link>
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
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    }`}
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
        <Link
          href="/labels"
          className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors block"
        >
          Labels
        </Link>
        <ul className="space-y-0.5" role="list">
          {labels.filter(l => l.name).map((l) => {
            const labelName = l.name as string;
            const active = pathname === `/labels/${encodeURIComponent(labelName)}`;
            const labelColor = l.color ?? '#6366F1';
            return (
              <li key={l.id}>
                <Link
                  href={`/labels/${encodeURIComponent(labelName)}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: labelColor }} aria-hidden="true" />
                  <span className="truncate">{labelName}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
          Filters
        </p>
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

      {/* Bottom: sync + sign out */}
      <div className="border-t border-border pb-2">
        <SyncStatusIndicator />
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
