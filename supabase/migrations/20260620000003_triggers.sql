-- Function: always set updated_at to now() on any UPDATE
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at        before update on tasks        for each row execute function set_updated_at();
create trigger projects_updated_at     before update on projects     for each row execute function set_updated_at();
create trigger labels_updated_at       before update on labels       for each row execute function set_updated_at();
create trigger user_settings_updated_at before update on user_settings for each row execute function set_updated_at();
create trigger saved_filters_updated_at before update on saved_filters for each row execute function set_updated_at();
create trigger reminders_updated_at    before update on reminders    for each row execute function set_updated_at();
create trigger attachments_updated_at  before update on attachments  for each row execute function set_updated_at();

-- Function: override user_id with the authenticated user on INSERT.
-- Prevents a client from inserting rows for another user even if they craft a payload.
create or replace function enforce_user_id()
returns trigger language plpgsql security definer as $$
begin
  new.user_id = auth.uid();
  return new;
end;
$$;

create trigger tasks_enforce_user_id       before insert on tasks       for each row execute function enforce_user_id();
create trigger projects_enforce_user_id    before insert on projects    for each row execute function enforce_user_id();
create trigger labels_enforce_user_id      before insert on labels      for each row execute function enforce_user_id();
create trigger reminders_enforce_user_id   before insert on reminders   for each row execute function enforce_user_id();
create trigger attachments_enforce_user_id before insert on attachments for each row execute function enforce_user_id();
