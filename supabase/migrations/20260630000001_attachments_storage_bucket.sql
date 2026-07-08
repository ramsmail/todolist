-- Create the attachments storage bucket for private user files
-- Users can only read/write objects under their own user_id/ prefix

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Enable RLS on the attachments bucket
alter table storage.objects enable row level security;

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
