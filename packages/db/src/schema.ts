import { column, Schema, Table } from '@powersync/common';

const tasks = new Table(
  {
    user_id:          column.text,
    title:            column.text,
    description:      column.text,
    status:           column.text,
    priority:         column.integer,
    due_date:         column.text,
    due_time:         column.text,
    timezone:         column.text,
    project_id:       column.text,
    parent_task_id:   column.text,
    recurrence_rule:  column.text,
    recurrence_start: column.text,
    labels:           column.text,   // JSON array stored as text
    sort_order:       column.text,
    created_at:       column.text,
    updated_at:       column.text,
    deleted_at:       column.text,
    in_focus:         column.integer,
  },
  {
    indexes: {
      by_project:  ['project_id'],
      by_parent:   ['parent_task_id'],
      by_status:   ['status'],
      by_due_date: ['due_date'],
    },
  }
);

const projects = new Table(
  {
    user_id:     column.text,
    name:        column.text,
    description: column.text,
    category:    column.text,
    due_date:    column.text,
    color:       column.text,
    icon:        column.text,
    is_archived: column.integer,
    sort_order:  column.text,
    created_at:  column.text,
    updated_at:  column.text,
    deleted_at:  column.text,
  },
  { indexes: { by_name: ['name'], by_category: ['category'] } }
);

const labels = new Table(
  {
    user_id:    column.text,
    name:       column.text,
    color:      column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { by_name: ['name'] } }
);

const saved_filters = new Table(
  {
    user_id:    column.text,
    name:       column.text,
    icon:       column.text,
    query:      column.text,   // JSON-serialised FilterQuery
    sort_order: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_sort: ['sort_order'] } }
);

const attachments = new Table(
  {
    task_id:          column.text,
    user_id:          column.text,
    type:             column.text,
    filename:         column.text,
    mime_type:        column.text,
    size_bytes:       column.integer,
    storage_path:     column.text,
    local_uri:        column.text,
    thumbnail_uri:    column.text,
    duration_seconds: column.real,
    created_at:       column.text,
    updated_at:       column.text,
    deleted_at:       column.text,
  },
  { indexes: { by_task: ['task_id'] } }
);

const reminders = new Table(
  {
    task_id:         column.text,
    user_id:         column.text,
    remind_at_local: column.text,
    remind_at_utc:   column.text,
    notified_mobile: column.integer,
    notified_web:    column.integer,
    created_at:      column.text,
    updated_at:      column.text,
    deleted_at:      column.text,
  },
  { indexes: { by_task: ['task_id'] } }
);

// user_settings: row id IS the user id (no separate user_id column)
const user_settings = new Table({
  timezone:              column.text,
  expo_push_token:       column.text,
  web_push_subscription: column.text,
  theme:                 column.text,
  created_at:            column.text,
  updated_at:            column.text,
});

export const AppSchema = new Schema({ tasks, projects, labels, saved_filters, attachments, reminders, user_settings });

export type Database               = (typeof AppSchema)['types'];
export type TaskRecord             = Database['tasks'];
export type ProjectRecord          = Database['projects'];
export type LabelRecord            = Database['labels'];
export type SavedFilterRecord      = Database['saved_filters'];
export type AttachmentRecord       = Database['attachments'];
export type ReminderRecord         = Database['reminders'];
export type UserSettingsRecord     = Database['user_settings'];
