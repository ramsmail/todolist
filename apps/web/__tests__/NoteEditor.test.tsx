import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@todolist/db', () => ({
  updateNote: vi.fn().mockResolvedValue(undefined),
  createLinkedTask: vi.fn().mockResolvedValue({ taskId: 't1' }),
  setNoteSourceUrl: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/notes/enrichUrl', () => ({ invokeEnrichUrl: vi.fn() }));
vi.mock('@/lib/notes/enrichPending', () => ({ enrichState: {}, runPendingEnrichment: vi.fn().mockResolvedValue(undefined) }));

import { updateNote, createLinkedTask, setNoteSourceUrl } from '@todolist/db';
import { runPendingEnrichment } from '@/lib/notes/enrichPending';
import { NoteEditor } from '@/components/notes/NoteEditor';

const note = (over: Record<string, unknown> = {}) => ({ id: 'n1', title: 'Plan', body: 'hello', source_url: null, ...over });
const body = () => screen.getByLabelText('Note body') as HTMLTextAreaElement;

describe('NoteEditor', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the note title and body', () => {
    render(<NoteEditor note={note()} userId="u1" />);
    expect(screen.getByLabelText('Note title')).toHaveValue('Plan');
    expect(body()).toHaveValue('hello');
  });

  it('autosaves the body 500ms after typing stops, sending only what changed', () => {
    vi.useFakeTimers();
    render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'hello world' } });
    act(() => { vi.advanceTimersByTime(499); });
    expect(updateNote).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { body: 'hello world' });
  });

  it('autosaves a title change on its own', () => {
    vi.useFakeTimers();
    render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'New title' } });
    act(() => { vi.advanceTimersByTime(500); });
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { title: 'New title' });
  });

  it('saves immediately on blur', () => {
    vi.useFakeTimers();
    render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'changed' } });
    fireEvent.blur(body());
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { body: 'changed' });
  });

  it('saves a pending edit when the editor unmounts', () => {
    vi.useFakeTimers();
    const { unmount } = render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'unsaved' } });
    unmount();
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { body: 'unsaved' });
  });

  it('toolbar Bold wraps the selection and keeps it selected', () => {
    render(<NoteEditor note={note({ body: '' })} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'say hello now' } });
    body().setSelectionRange(4, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(body()).toHaveValue('say **hello** now');
    expect(body().selectionStart).toBe(6);
    expect(body().selectionEnd).toBe(11);
  });

  it('Selection to task is disabled until text is selected, then creates a linked task', async () => {
    render(<NoteEditor note={note({ body: '- [ ] Call the bank' })} userId="u1" />);
    const button = screen.getByRole('button', { name: 'Selection to task' });
    expect(button).toBeDisabled();

    body().setSelectionRange(0, body().value.length);
    fireEvent.select(body());
    expect(button).toBeEnabled();

    await act(async () => { fireEvent.click(button); });
    expect(createLinkedTask).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u1', noteId: 'n1', title: 'Call the bank',
    });
  });

  it('pasting a url into an empty note sets the source url and starts enrichment', async () => {
    render(<NoteEditor note={note({ body: '' })} userId="u1" />);
    await act(async () => {
      fireEvent.paste(body(), { clipboardData: { getData: () => 'https://example.com/post' } });
    });
    await waitFor(() => expect(setNoteSourceUrl).toHaveBeenCalledWith(expect.anything(), 'n1', 'https://example.com/post'));
    expect(runPendingEnrichment).toHaveBeenCalledTimes(1);
  });

  it('does not treat a paste as a link capture when the note already has text or a url', async () => {
    const { rerender } = render(<NoteEditor note={note({ body: 'already writing' })} userId="u1" />);
    await act(async () => {
      fireEvent.paste(body(), { clipboardData: { getData: () => 'https://example.com' } });
    });
    rerender(<NoteEditor note={note({ body: '', source_url: 'https://old.com' })} userId="u1" />);
    await act(async () => {
      fireEvent.paste(body(), { clipboardData: { getData: () => 'https://example.com' } });
    });
    expect(setNoteSourceUrl).not.toHaveBeenCalled();
  });

  it('switches to a rendered preview', () => {
    render(<NoteEditor note={note({ body: 'say **hi**' })} userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('hi').tagName).toBe('STRONG');
    expect(screen.queryByLabelText('Note body')).toBeNull();
  });

  it('adopts a remote change when there is no pending edit, but not while typing', () => {
    vi.useFakeTimers();
    const { rerender } = render(<NoteEditor note={note({ body: 'v1' })} userId="u1" />);
    rerender(<NoteEditor note={note({ body: 'remote v2' })} userId="u1" />);
    expect(body()).toHaveValue('remote v2');

    fireEvent.change(body(), { target: { value: 'my local edit' } });
    rerender(<NoteEditor note={note({ body: 'remote v3' })} userId="u1" />);
    expect(body()).toHaveValue('my local edit');
  });
});
