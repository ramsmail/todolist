import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { ImmersiveProvider } from '@/lib/focus/ImmersiveContext';
import { ImmersiveToggle } from '@/components/focus/ImmersiveToggle';

function Wrapper() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ImmersiveProvider>
      <div ref={ref}>
        <ImmersiveToggle targetRef={ref} />
      </div>
    </ImmersiveProvider>
  );
}

describe('ImmersiveToggle', () => {
  const originalRequestFullscreen = Element.prototype.requestFullscreen;
  const originalExitFullscreen = document.exitFullscreen;

  beforeEach(() => {
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
  });

  afterEach(() => {
    Element.prototype.requestFullscreen = originalRequestFullscreen;
    document.exitFullscreen = originalExitFullscreen;
    vi.restoreAllMocks();
  });

  it('shows "Enter Immersive Mode" by default', () => {
    render(<Wrapper />);
    expect(screen.getByText('Enter Immersive Mode')).toBeInTheDocument();
  });

  it('requests fullscreen and flips label on click', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: HTMLElement) {
      Object.defineProperty(document, 'fullscreenElement', { value: this, writable: true, configurable: true });
      return Promise.resolve();
    });
    render(<Wrapper />);
    await act(async () => { screen.getByText('Enter Immersive Mode').click(); });
    expect(Element.prototype.requestFullscreen).toHaveBeenCalledOnce();
    expect(screen.getByText('Exit Immersive Mode')).toBeInTheDocument();
  });

  it('falls back to a chrome-hidden state if the Fullscreen API throws', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
    render(<Wrapper />);
    await act(async () => { screen.getByText('Enter Immersive Mode').click(); });
    expect(screen.getByText('Exit Immersive Mode')).toBeInTheDocument();
  });

  it('reverts to "Enter Immersive Mode" when the browser exits fullscreen (e.g. Esc)', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockImplementation(function (this: HTMLElement) {
      Object.defineProperty(document, 'fullscreenElement', { value: this, writable: true, configurable: true });
      return Promise.resolve();
    });
    render(<Wrapper />);
    await act(async () => { screen.getByText('Enter Immersive Mode').click(); });
    expect(screen.getByText('Exit Immersive Mode')).toBeInTheDocument();

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.getByText('Enter Immersive Mode')).toBeInTheDocument();
  });
});
