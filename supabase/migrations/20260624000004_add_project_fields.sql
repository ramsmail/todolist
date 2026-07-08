-- Add description, category, due_date to projects table
ALTER TABLE projects
ADD COLUMN description     text,
ADD COLUMN category        text NOT NULL DEFAULT 'Personal'
                          CHECK (category IN ('Business','Learning','Habit','Personal','Backlog')),
ADD COLUMN due_date        date;

-- Index on category for filtering later
CREATE INDEX projects_category_idx ON projects (category) WHERE deleted_at IS NULL;
