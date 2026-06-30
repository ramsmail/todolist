-- Add source_url column to tasks for storing original URLs from share intent
ALTER TABLE tasks ADD COLUMN source_url text;
