import { describe, it, expect } from 'vitest';
import { parseLabelsJson, mergeLabels } from './labels';

describe('parseLabelsJson', () => {
  it('parses a JSON array string into a string array', () => {
    expect(parseLabelsJson('["work","urgent"]')).toEqual(['work', 'urgent']);
  });

  it('returns an empty array for null', () => {
    expect(parseLabelsJson(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(parseLabelsJson(undefined)).toEqual([]);
  });

  it('returns an empty array for malformed JSON', () => {
    expect(parseLabelsJson('not json')).toEqual([]);
  });

  it('returns an empty array when the JSON is not an array', () => {
    expect(parseLabelsJson('{"a":1}')).toEqual([]);
  });

  it('filters out non-string entries', () => {
    expect(parseLabelsJson('["work",1,null]')).toEqual(['work']);
  });

  // PowerSync round-trips the jsonb `labels` column back as a double-JSON-encoded
  // string (a text-column mirror of jsonb). The parser must tolerate both forms.
  it('parses a double-encoded array (jsonb round-trip)', () => {
    expect(parseLabelsJson('"[\\"guitar\\"]"')).toEqual(['guitar']);
  });

  it('parses a double-encoded multi-item array', () => {
    expect(parseLabelsJson('"[\\"work\\",\\"home\\"]"')).toEqual(['work', 'home']);
  });

  it('parses a double-encoded empty array to empty', () => {
    expect(parseLabelsJson('"[]"')).toEqual([]);
  });
});

describe('mergeLabels', () => {
  it('combines two lists with no overlap', () => {
    expect(mergeLabels(['work'], ['home'])).toEqual(['work', 'home']);
  });

  it('de-dupes case-insensitively, keeping the first-seen casing', () => {
    expect(mergeLabels(['Work'], ['work', 'home'])).toEqual(['Work', 'home']);
  });

  it('handles any number of lists', () => {
    expect(mergeLabels(['a'], ['b'], ['a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when all lists are empty', () => {
    expect(mergeLabels([], [])).toEqual([]);
  });
});
