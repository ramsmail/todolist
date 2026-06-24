import { renderHook, act, waitFor } from '@testing-library/react';
import { useViewMode } from '@/hooks/useViewMode';

describe('useViewMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return "list" as default when localStorage is empty', () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('list');
  });

  it('should return "board" when previously saved to localStorage', () => {
    localStorage.setItem('today-view-mode', 'board');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('board');
  });

  it('should update localStorage when setMode is called', () => {
    const { result } = renderHook(() => useViewMode());
    act(() => {
      result.current.setMode('board');
    });
    expect(localStorage.getItem('today-view-mode')).toBe('board');
    expect(result.current.mode).toBe('board');
  });

  it('should return "list" if localStorage has invalid value', () => {
    localStorage.setItem('today-view-mode', 'invalid');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('list');
  });

  it('should have mounted state available to prevent hydration mismatch', () => {
    const { result } = renderHook(() => useViewMode());
    // After effect runs, mounted should be true
    expect(result.current.mounted).toBe(true);
    // Verify mounted is part of the return value
    expect(typeof result.current.mounted).toBe('boolean');
  });
});
