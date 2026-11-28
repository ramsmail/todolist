import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FocusRing } from '@/components/focus/FocusRing';

describe('FocusRing', () => {
  it('renders MM:SS for the given secondsLeft', () => {
    render(<FocusRing phase="focus" secondsLeft={1500} totalSeconds={1500} />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('pads seconds under 10', () => {
    render(<FocusRing phase="focus" secondsLeft={65} totalSeconds={1500} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('labels a focus phase "Focus Session"', () => {
    render(<FocusRing phase="focus" secondsLeft={1500} totalSeconds={1500} />);
    expect(screen.getByText('Focus Session')).toBeInTheDocument();
  });

  it('labels a short break phase "Short Break"', () => {
    render(<FocusRing phase="shortBreak" secondsLeft={300} totalSeconds={300} />);
    expect(screen.getByText('Short Break')).toBeInTheDocument();
  });

  it('labels a long break phase "Long Break"', () => {
    render(<FocusRing phase="longBreak" secondsLeft={900} totalSeconds={900} />);
    expect(screen.getByText('Long Break')).toBeInTheDocument();
  });
});
