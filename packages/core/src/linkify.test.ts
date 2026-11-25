import { describe, it, expect } from 'vitest';
import { splitTextWithLinks, toHref } from './linkify';

describe('splitTextWithLinks', () => {
  it('returns a single text segment when there is no URL', () => {
    expect(splitTextWithLinks('Buy milk')).toEqual([
      { type: 'text', value: 'Buy milk' },
    ]);
  });

  it('returns a single link segment when the whole string is a URL', () => {
    expect(splitTextWithLinks('https://example.com')).toEqual([
      { type: 'link', value: 'https://example.com' },
    ]);
  });

  it('splits a URL out of surrounding text', () => {
    expect(splitTextWithLinks('See https://example.com/path for details')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://example.com/path' },
      { type: 'text', value: ' for details' },
    ]);
  });

  it('handles multiple URLs in the same string', () => {
    expect(splitTextWithLinks('https://a.com and https://b.com')).toEqual([
      { type: 'link', value: 'https://a.com' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'https://b.com' },
    ]);
  });

  it('recognizes http (not just https) URLs', () => {
    expect(splitTextWithLinks('http://example.com')).toEqual([
      { type: 'link', value: 'http://example.com' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(splitTextWithLinks('')).toEqual([]);
  });

  it('does not treat a bare word as a link', () => {
    expect(splitTextWithLinks('example.com without scheme')).toEqual([
      { type: 'text', value: 'example.com without scheme' },
    ]);
  });

  it('recognizes a www.-prefixed domain with no scheme', () => {
    expect(splitTextWithLinks('Check www.cnn.com now')).toEqual([
      { type: 'text', value: 'Check ' },
      { type: 'link', value: 'www.cnn.com' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('does not double-match the www. inside a full scheme URL', () => {
    expect(splitTextWithLinks('https://www.cnn.com/story')).toEqual([
      { type: 'link', value: 'https://www.cnn.com/story' },
    ]);
  });
});

describe('toHref', () => {
  it('leaves an https URL unchanged', () => {
    expect(toHref('https://example.com')).toBe('https://example.com');
  });

  it('leaves an http URL unchanged', () => {
    expect(toHref('http://example.com')).toBe('http://example.com');
  });

  it('prepends https:// to a scheme-less www. domain', () => {
    expect(toHref('www.cnn.com')).toBe('https://www.cnn.com');
  });
});
