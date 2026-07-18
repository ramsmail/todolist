import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FocusControls } from '@/components/focus/FocusControls';

describe('FocusControls', () => {
  it('shows a Play button when not running', () => {
    render(<FocusControls isRunning={false} canStart onPlayPause={vi.fn()} onReset={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('shows a Pause button when running', () => {
    render(<FocusControls isRunning canStart onPlayPause={vi.fn()} onReset={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('disables Play until a task can be started', () => {
    render(<FocusControls isRunning={false} canStart={false} onPlayPause={vi.fn()} onReset={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('calls onPlayPause when the play/pause button is clicked', () => {
    const onPlayPause = vi.fn();
    render(<FocusControls isRunning={false} canStart onPlayPause={onPlayPause} onReset={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlayPause).toHaveBeenCalledOnce();
  });

  it('calls onReset when the reset button is clicked', () => {
    const onReset = vi.fn();
    render(<FocusControls isRunning={false} canStart onPlayPause={vi.fn()} onReset={onReset} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('calls onSkip when the skip button is clicked', () => {
    const onSkip = vi.fn();
    render(<FocusControls isRunning={false} canStart onPlayPause={vi.fn()} onReset={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
