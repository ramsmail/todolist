import { describe, it, expect } from 'vitest';
import { noteDisplayTitle, noteExcerpt, selectionToTaskTitle, extractSoleUrl } from './noteText';

describe('noteDisplayTitle', () => {
  it('uses the explicit title when present', () => {
    expect(noteDisplayTitle({ title: '  Plan  ', body: 'x', link_title: 'L' })).toBe('Plan');
  });
  it('falls back to link_title', () => {
    expect(noteDisplayTitle({ title: '', body: '', link_title: 'Article' })).toBe('Article');
  });
  it('falls back to the first non-empty body line, stripped of markdown markers', () => {
    expect(noteDisplayTitle({ title: '', body: '\n\n## - [ ] Big idea here\nmore' })).toBe('Big idea here');
  });
  it('truncates long fallback lines to 80 chars with an ellipsis', () => {
    const t = noteDisplayTitle({ title: '', body: 'a'.repeat(200) });
    expect(t.length).toBe(80);
    expect(t.endsWith('…')).toBe(true);
  });
  it('returns Untitled when nothing is available', () => {
    expect(noteDisplayTitle({ title: null, body: null })).toBe('Untitled');
  });
});

describe('noteExcerpt', () => {
  it('skips the body line used as the title when the title is blank', () => {
    expect(noteExcerpt({ title: '', body: 'Idea\nsecond line\nthird' })).toBe('second line third');
  });
  it('uses the whole body when an explicit title exists', () => {
    expect(noteExcerpt({ title: 'T', body: 'first\nsecond' })).toBe('first second');
  });
  it('strips markdown markers and caps length', () => {
    const e = noteExcerpt({ title: 'T', body: '- **bold** item\n' + 'x'.repeat(300) }, 50);
    expect(e.startsWith('bold item')).toBe(true);
    expect(e.length).toBe(50);
  });
  it('falls back to link_excerpt when the body is empty', () => {
    expect(noteExcerpt({ title: 'T', body: '', link_excerpt: 'From the page' })).toBe('From the page');
  });
});

describe('selectionToTaskTitle', () => {
  it('strips list, checkbox and heading markers and collapses whitespace', () => {
    expect(selectionToTaskTitle('  - [ ]   Call   the   bank \n')).toBe('Call the bank');
    expect(selectionToTaskTitle('### Write post')).toBe('Write post');
    expect(selectionToTaskTitle('1. Ship it')).toBe('Ship it');
  });
  it('joins multi-line selections into one line', () => {
    expect(selectionToTaskTitle('- one\n- two')).toBe('one two');
  });
  it('caps at 200 chars', () => {
    expect(selectionToTaskTitle('x'.repeat(500)).length).toBe(200);
  });
});

describe('extractSoleUrl', () => {
  it('returns the URL when the text is exactly one http(s) URL', () => {
    expect(extractSoleUrl('  https://example.com/a?b=1  ')).toBe('https://example.com/a?b=1');
  });
  it('returns null for text with other words', () => {
    expect(extractSoleUrl('see https://example.com')).toBeNull();
  });
  it('returns null for non-http schemes', () => {
    expect(extractSoleUrl('javascript:alert(1)')).toBeNull();
    expect(extractSoleUrl('ftp://x.y')).toBeNull();
  });
});
