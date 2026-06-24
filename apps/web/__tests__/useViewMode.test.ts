import { renderHook, act } from '@testing-library/react';
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
});
