import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldIgnoreShortcut } from '@/lib/shortcuts/shouldIgnoreShortcut';

const newNote = vi.fn();
vi.mock('@/hooks/useNewNote', () => ({ useNewNote: () => newNote }));
vi.mock('@/lib/shortcuts/ShortcutContext', () => ({ useShortcuts: () => ({ openShortcuts: vi.fn() }) }));

import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';

describe('shouldIgnoreShortcut', () => {
  it('ignores typing targets', () => {
    expect(shouldIgnoreShortcut(document.createElement('input'))).toBe(true);
    expect(shouldIgnoreShortcut(document.createElement('textarea'))).toBe(true);
    expect(shouldIgnoreShortcut(document.createElement('select'))).toBe(true);
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(shouldIgnoreShortcut(editable)).toBe(true);
  });

  it('ignores anything inside a dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    expect(shouldIgnoreShortcut(button)).toBe(true);
  });

  it('allows the page body and buttons', () => {
    expect(shouldIgnoreShortcut(document.body)).toBe(false);
    expect(shouldIgnoreShortcut(document.createElement('button'))).toBe(false);
    expect(shouldIgnoreShortcut(null)).toBe(false);
  });
});

describe('KeyboardShortcuts: n for new note', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const mount = () => render(<KeyboardShortcuts onOpenQuickCapture={vi.fn()}><div /></KeyboardShortcuts>);

  it('creates a note on a bare n', () => {
    mount();
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(newNote).toHaveBeenCalledTimes(1);
  });

  it('does nothing while typing in a field', () => {
    mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n' });
    expect(newNote).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing with a modifier held', () => {
    mount();
    fireEvent.keyDown(document.body, { key: 'n', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'n', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'n', altKey: true });
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    expect(newNote).not.toHaveBeenCalled();
  });

  it('still opens quick capture on Cmd+Enter', () => {
    const onOpen = vi.fn();
    render(<KeyboardShortcuts onOpenQuickCapture={onOpen}><div /></KeyboardShortcuts>);
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
