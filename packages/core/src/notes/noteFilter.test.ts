import { describe, it, expect } from 'vitest';
import { filterNotes } from './noteFilter';

const thought = { id: 'a', source_url: null, project_id: 'p1', labels: '["work"]' };
const link = { id: 'b', source_url: 'https://x.com', project_id: null, labels: '["read","work"]' };
const blankUrl = { id: 'c', source_url: '   ', project_id: null, labels: '[]' };
const all = [thought, link, blankUrl];

describe('filterNotes', () => {
  it('returns everything by default', () => {
    expect(filterNotes(all, {})).toEqual(all);
  });
  it('links keeps only notes with a source_url', () => {
    expect(filterNotes(all, { kind: 'links' }).map(n => n.id)).toEqual(['b']);
  });
  it('thoughts keeps notes without a (non-blank) source_url', () => {
    expect(filterNotes(all, { kind: 'thoughts' }).map(n => n.id)).toEqual(['a', 'c']);
  });
  it('filters by project', () => {
    expect(filterNotes(all, { projectId: 'p1' }).map(n => n.id)).toEqual(['a']);
  });
  it('filters by label from the JSON labels column', () => {
    expect(filterNotes(all, { label: 'read' }).map(n => n.id)).toEqual(['b']);
    expect(filterNotes(all, { label: 'work' }).map(n => n.id)).toEqual(['a', 'b']);
  });
  it('combines filters with AND', () => {
    expect(filterNotes(all, { kind: 'thoughts', label: 'work' }).map(n => n.id)).toEqual(['a']);
  });
  it('treats null/empty project and label filters as "no filter"', () => {
    expect(filterNotes(all, { projectId: null, label: null })).toEqual(all);
  });
});
