-- supabase/tests/notes_test.sql
-- Run: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/notes_test.sql
-- Everything is rolled back at the end.
begin;

-- Two users, created as superuser before switching role.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into notes (id, user_id, title, body, revision, base_revision)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Plan', 'v0', 0, 0);

-- T1: accepted edit (base matches) keeps incoming body and revision.
update notes set body = 'v1', base_revision = 0, revision = 1
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ declare r notes; begin
  select * into r from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert r.body = 'v1' and r.revision = 1, 'T1 accepted edit: got body=' || r.body || ' rev=' || r.revision;
end $$;

-- T2: chained offline edits (1->2, 2->3) are accepted without conflict copies.
update notes set body = 'v2', base_revision = 1, revision = 2 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update notes set body = 'v3', base_revision = 2, revision = 3 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select body from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'v3', 'T2 chained: body not v3';
  assert (select count(*) from notes where conflict_of = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'T2 chained: unexpected conflict copy';
end $$;

-- T3: stale edit (base 1, server at 3) -> original kept, exactly one conflict copy.
update notes set body = 'stale-device', base_revision = 1, revision = 2
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ declare r notes; c notes; begin
  select * into r from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert r.body = 'v3' and r.revision = 3, 'T3 stale: original overwritten (body=' || r.body || ')';
  assert (select count(*) from notes where conflict_of = r.id) = 1, 'T3 stale: expected exactly one conflict copy';
  select * into c from notes where conflict_of = r.id;
  assert c.body = 'stale-device', 'T3 stale: copy has wrong body';
  assert c.title like 'Plan (conflict, %', 'T3 stale: copy title was ' || c.title;
  assert c.user_id = '11111111-1111-1111-1111-111111111111', 'T3 stale: copy has wrong owner';
end $$;

-- T4: non-body edits are plain last-write-wins (no revision check).
update notes set title = 'Plan v2', base_revision = 0 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select title from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Plan v2', 'T4 title LWW failed';
  assert (select count(*) from notes where conflict_of = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'T4 title edit created a conflict copy';
end $$;

-- T5: body edit to a soft-deleted note -> delete stands, text saved as conflict copy.
update notes set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update notes set body = 'edited-after-delete', base_revision = 3, revision = 4
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select deleted_at is not null and body = 'v3' from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'T5 deleted note was modified';
  assert exists (select 1 from notes where conflict_of = 'aaaaaaaa-0000-0000-0000-000000000001' and body = 'edited-after-delete'), 'T5 text lost';
end $$;

-- T6: link_status check constraint.
do $$ begin
  begin
    insert into notes (user_id, link_status) values ('11111111-1111-1111-1111-111111111111', 'bogus');
    assert false, 'T6 link_status accepted bogus value';
  exception when check_violation then null;
  end;
end $$;

-- T7: links unique + type check.
insert into links (user_id, from_type, from_id, to_type, to_id) values
  ('11111111-1111-1111-1111-111111111111', 'note', 'aaaaaaaa-0000-0000-0000-000000000001', 'task', 'bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'note', 'aaaaaaaa-0000-0000-0000-000000000001', 'task', 'bbbbbbbb-0000-0000-0000-000000000001');
    assert false, 'T7 duplicate link accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'person', gen_random_uuid(), 'task', gen_random_uuid());
    -- person is now a valid link type (phase 4), no exception expected
  exception when check_violation then
    assert false, 'T7 person link type rejected (should be allowed)';
  end;
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'unknown_type', gen_random_uuid(), 'task', gen_random_uuid());
    assert false, 'T7 unknown link type accepted';
  exception when check_violation then null;
  end;
end $$;

-- T8: links are hard-deletable by owner.
delete from links where from_id = 'aaaaaaaa-0000-0000-0000-000000000001' and from_type = 'note';
do $$ begin
  assert (select count(*) from links where from_type = 'note' and from_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'T8 link not deleted';
end $$;

-- T9: insert forces user_id to the caller (enforce_user_id), even if spoofed.
insert into notes (id, user_id, title) values ('aaaaaaaa-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'spoof');
do $$ begin
  assert (select user_id from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = '11111111-1111-1111-1111-111111111111', 'T9 user_id spoof succeeded';
end $$;
insert into links (id, user_id, from_type, from_id, to_type, to_id) values
  ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'note', gen_random_uuid(), 'task', gen_random_uuid());
do $$ begin
  assert (select user_id from links where id = 'cccccccc-0000-0000-0000-000000000001') = '11111111-1111-1111-1111-111111111111', 'T9 links user_id spoof succeeded';
end $$;

-- T10: RLS: user B sees none of A's notes or links and cannot update them.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from notes) = 0, 'T10 RLS: B can read A''s notes';
  assert (select count(*) from links) = 0, 'T10 RLS: B can read A''s links';
end $$;
update notes set title = 'hijack' where id = 'aaaaaaaa-0000-0000-0000-000000000009';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  assert (select title from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = 'spoof', 'T10 RLS: B updated A''s note';
end $$;

-- T11: is_processed defaults to false and can be toggled.
do $$ begin
  assert (select is_processed from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = false, 'T11 is_processed default not false';
end $$;
update notes set is_processed = true where id = 'aaaaaaaa-0000-0000-0000-000000000009';
do $$ begin
  assert (select is_processed from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = true, 'T11 is_processed update failed';
end $$;

-- T12: links origin defaults to 'manual' and rejects unknown values.
insert into links (user_id, from_type, from_id, to_type, to_id) values
  ('11111111-1111-1111-1111-111111111111', 'note', gen_random_uuid(), 'task', gen_random_uuid());
do $$ begin
  assert (select origin from links order by created_at desc limit 1) = 'manual', 'T12 links origin default not manual';
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id, origin) values
      ('11111111-1111-1111-1111-111111111111', 'note', gen_random_uuid(), 'task', gen_random_uuid(), 'auto');
    assert false, 'T12 unknown origin accepted';
  exception when check_violation then null;
  end;
end $$;

-- T13: link types include person and project (future entity types).
do $$ begin
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'person', gen_random_uuid(), 'note', gen_random_uuid());
    delete from links where from_type = 'person';
  end;
end $$;

\echo 'ALL NOTES TESTS PASSED'
rollback;
