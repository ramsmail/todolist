-- User settings (one row per user, id = auth.uid())
create table user_settings (
  id         uuid primary key references auth.users(id) on delete cascade,
  timezone   text        not null default 'UTC',
  expo_push_token       text,
  web_push_subscription jsonb,
  theme      text        not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table projects (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#6366F1',
  icon        text        not null default '📁',
  is_archived boolean     not null default false,
  sort_order  text        not null default 'a0',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Labels
create table labels (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  color      text        not null default '#6366F1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint labels_user_name_unique unique (user_id, name)
);

-- Tasks
create table tasks (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  title            text        not null,
  description      text,
  status           text        not null default 'inbox'
                               check (status in ('inbox','active','completed','cancelled')),
  priority         integer     not null default 4
                               check (priority between 1 and 4),
  due_date         date,
  due_time         time,
  timezone         text,
  project_id       uuid        references projects(id) on delete set null,
  parent_task_id   uuid        references tasks(id) on delete cascade,
  recurrence_rule  text,
  recurrence_start date,
  labels           jsonb       not null default '[]',
  sort_order       text        not null default 'a0',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index tasks_user_id_idx    on tasks (user_id);
create index tasks_project_id_idx on tasks (project_id);
create index tasks_due_date_idx   on tasks (due_date);
create index tasks_labels_gin_idx on tasks using gin (labels);

-- Saved filters (Phase 2 — created now so sync rules cover it)
create table saved_filters (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  icon       text,
  query      jsonb       not null,
  sort_order text        not null default 'a0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Reminders (Phase 3)
create table reminders (
  id              uuid        primary key default gen_random_uuid(),
  task_id         uuid        not null references tasks(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  remind_at_local timestamptz not null,
  remind_at_utc   timestamptz not null,
  notified_mobile boolean     not null default false,
  notified_web    boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Attachments (Phase 3)
create table attachments (
  id               uuid        primary key default gen_random_uuid(),
  task_id          uuid        not null references tasks(id) on delete cascade,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  type             text        not null check (type in ('image','audio','file')),
  filename         text        not null,
  mime_type        text        not null,
  size_bytes       integer     not null,
  storage_path     text        not null,
  local_uri        text,
  thumbnail_uri    text,
  duration_seconds float,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
