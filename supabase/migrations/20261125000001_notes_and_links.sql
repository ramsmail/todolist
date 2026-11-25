-- Notes Core (second brain phase 1): notes + generic links.
-- Spec: docs/superpowers/specs/2026-11-25-notes-core-design.md

create table notes (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text        not null default '',
  body           text        not null default '',
  project_id     uuid        references projects(id) on delete set null,
  labels         jsonb       not null default '[]',
  is_archived    boolean     not null default false,
  is_processed   boolean     not null default false,
  source_url     text,
  link_title     text,
  link_excerpt   text,
  link_image_url text,
  link_site_name text,
  link_status    text        check (link_status in ('pending','ok','failed')),
  revision       integer     not null default 0,
  base_revision  integer     not null default 0,
  conflict_of    uuid        references notes(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index notes_user_updated_idx on notes (user_id, updated_at desc);
create index notes_project_idx      on notes (project_id);
create index notes_labels_gin_idx   on notes using gin (labels);

-- Generic links. v1 stores note->task only; phase 2 adds note->note.
-- Hard delete (no deleted_at): a link has no content worth keeping, and soft
-- delete would collide with the unique constraint when re-linking.
-- origin: 'manual' = user-created link; 'wikilink' = auto-synced [[link]].
-- Phase 2 must only create/delete 'wikilink' rows, never touch 'manual'.
create table links (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  from_type  text        not null check (from_type in ('note','task','person','project')),
  from_id    uuid        not null,
  to_type    text        not null check (to_type in ('note','task','person','project')),
  to_id      uuid        not null,
  origin     text        not null default 'manual' check (origin in ('manual','wikilink')),
  created_at timestamptz not null default now(),
  constraint links_unique unique (user_id, from_type, from_id, to_type, to_id)
);

create index links_from_idx on links (from_type, from_id);
create index links_to_idx   on links (to_type, to_id);

-- RLS: owner-scoped, mirrors the other per-user tables.
alter table notes enable row level security;
alter table links enable row level security;
create policy "own_notes" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_links" on links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants: authenticated and service_role need full DML access; RLS enforces row scope.
grant select, insert, update, delete on notes to authenticated, service_role;
grant select, insert, update, delete on links to authenticated, service_role;

create trigger notes_updated_at      before update on notes for each row execute function set_updated_at();
create trigger notes_enforce_user_id before insert on notes for each row execute function enforce_user_id();
create trigger links_enforce_user_id before insert on links for each row execute function enforce_user_id();

-- Conflict copy on concurrent body edits.
-- Clients send base_revision = the revision they edited from, revision = base + 1.
-- If the server has moved on (or the note is deleted), keep the server body and
-- save the incoming body as a new note pointing back via conflict_of.
-- Non-body fields stay last-write-wins.
create or replace function notes_body_conflict()
returns trigger language plpgsql as $$
begin
  if new.body is not distinct from old.body then
    return new;
  end if;

  if old.deleted_at is null and new.base_revision = old.revision then
    return new;
  end if;

  insert into notes (user_id, title, body, project_id, labels, source_url, conflict_of, revision, base_revision)
  values (
    old.user_id,
    coalesce(nullif(new.title, ''), nullif(old.title, ''), 'Untitled')
      || ' (conflict, ' || to_char(now() at time zone 'UTC', 'DD Mon HH24:MI') || ' UTC)',
    new.body,
    new.project_id,
    new.labels,
    new.source_url,
    old.id,
    0,
    0
  );

  new.body          := old.body;
  new.revision      := old.revision;
  new.base_revision := old.base_revision;
  new.deleted_at    := old.deleted_at;
  return new;
end;
$$;

-- Name sorts before notes_updated_at; Postgres fires BEFORE triggers alphabetically.
create trigger notes_body_conflict before update on notes for each row execute function notes_body_conflict();
