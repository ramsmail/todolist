import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutosave } from '@/hooks/useAutosave';

describe('useAutosave', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('saves only the latest value, once, after the delay', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { result.current.schedule('a'); });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.schedule('ab'); });
    act(() => { vi.advanceTimersByTime(499); });
    expect(save).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('ab');
  });

  it('flush saves immediately and cancels the timer', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { result.current.schedule('x'); });
    act(() => { void result.current.flush(); });
    expect(save).toHaveBeenCalledWith('x');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending does not save', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { void result.current.flush(); });
    expect(save).not.toHaveBeenCalled();
  });

  it('reports dirty while a save is pending', () => {
    const { result } = renderHook(() => useAutosave<string>(vi.fn(), 500));
    expect(result.current.isDirty()).toBe(false);
    act(() => { result.current.schedule('x'); });
    expect(result.current.isDirty()).toBe(true);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.isDirty()).toBe(false);
  });

  it('flushes a pending value on unmount (navigation)', () => {
    const save = vi.fn();
    const { result, unmount } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { result.current.schedule('last words'); });
    unmount();
    expect(save).toHaveBeenCalledWith('last words');
  });

  it('always calls the latest save callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useAutosave<string>(cb, 500), { initialProps: { cb: first } });
    act(() => { result.current.schedule('v'); });
    rerender({ cb: second });
    act(() => { vi.advanceTimersByTime(500); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('v');
  });
});
