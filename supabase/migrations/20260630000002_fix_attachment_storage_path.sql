-- Make storage_path nullable so attachments can be written with null and updated later
ALTER TABLE attachments ALTER COLUMN storage_path DROP NOT NULL;
