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
    color:       column.text,
    icon:        column.text,
    is_archived: column.integer,
    sort_order:  column.text,
    created_at:  column.text,
    updated_at:  column.text,
    deleted_at:  column.text,
  },
  { indexes: { by_name: ['name'] } }
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
  { indexes: { by_sort: ['sort_order'] } }
);

export const AppSchema = new Schema({ tasks, projects, labels, saved_filters });

export type Database          = (typeof AppSchema)['types'];
export type TaskRecord        = Database['tasks'];
export type ProjectRecord     = Database['projects'];
export type LabelRecord       = Database['labels'];
export type SavedFilterRecord = Database['saved_filters'];
