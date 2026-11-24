import { describe, it, expect } from 'vitest';
import { toggleInline, toggleLinePrefix, insertLink, type TextEdit } from './markdownEdit';

const at = (text: string, selStart: number, selEnd = selStart): TextEdit => ({ text, selStart, selEnd });

describe('toggleInline', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(toggleInline(at('say hello now', 4, 9), '**')).toEqual(at('say **hello** now', 6, 11));
  });
  it('unwraps when the selection is already wrapped', () => {
    expect(toggleInline(at('say **hello** now', 6, 11), '**')).toEqual(at('say hello now', 4, 9));
  });
  it('inserts an empty pair with the cursor inside when nothing is selected', () => {
    expect(toggleInline(at('ab', 1), '_')).toEqual(at('a__b', 2, 2));
  });
});

describe('toggleLinePrefix', () => {
  it('adds a prefix to every selected line', () => {
    expect(toggleLinePrefix(at('one\ntwo\nthree', 0, 7), '- ')).toEqual(at('- one\n- two\nthree', 0, 11));
  });
  it('removes the prefix when all selected lines have it', () => {
    expect(toggleLinePrefix(at('- one\n- two', 0, 11), '- ')).toEqual(at('one\ntwo', 0, 7));
  });
  it('works on the cursor line when nothing is selected', () => {
    expect(toggleLinePrefix(at('a\nbuy milk', 4), '- [ ] ')).toEqual(at('a\n- [ ] buy milk', 10, 10));
  });
  it('replaces an existing heading level rather than stacking', () => {
    expect(toggleLinePrefix(at('### Title', 4), '# ')).toEqual(at('# Title', 2, 2));
  });
});

describe('insertLink', () => {
  it('wraps the selection as link text and selects the url placeholder', () => {
    expect(insertLink(at('see docs here', 4, 8))).toEqual(at('see [docs](url) here', 11, 14));
  });
  it('inserts a full template when nothing is selected', () => {
    expect(insertLink(at('x', 1))).toEqual(at('x[text](url)', 8, 11));
  });
});
