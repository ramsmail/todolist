-- Create the attachments storage bucket for private user files
-- Users can only read/write objects under their own user_id/ prefix

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Enable RLS on the attachments bucket
-- (storage.objects is owned by supabase_storage_admin; this is a no-op when RLS is
-- already on, and silently skips the ALTER when the caller lacks ownership privileges,
-- which happens in the local dev stack where postgres is not the table owner.)
do $$
begin
  alter table storage.objects enable row level security;
exception when insufficient_privilege then
  null; -- already enabled by the storage service
end;
$$;

-- Read policy: users can read objects in their own user_id/ prefix
create policy "attachments_select_own"
on storage.objects for select
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Write policy: users can upload objects to their own user_id/ prefix
create policy "attachments_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Update policy: users can update their own objects
create policy "attachments_update_own"
on storage.objects for update
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete policy: users can delete their own objects
create policy "attachments_delete_own"
on storage.objects for delete
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
