alter table user_settings  enable row level security;
alter table projects        enable row level security;
alter table labels          enable row level security;
alter table tasks           enable row level security;
alter table saved_filters   enable row level security;
alter table reminders       enable row level security;
alter table attachments     enable row level security;

-- Single policy per table: all operations scoped to authenticated owner.
-- user_settings: id IS the user id
create policy "own_settings"      on user_settings  for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own_projects"      on projects        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_labels"        on labels          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_tasks"         on tasks           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_saved_filters" on saved_filters   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_reminders"     on reminders       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_attachments"   on attachments     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
