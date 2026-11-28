import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RoundIndicator } from '@/components/focus/RoundIndicator';

describe('RoundIndicator', () => {
  it('renders round, total rounds, and duration', () => {
    render(<RoundIndicator round={1} durationMinutes={25} />);
    expect(screen.getByText(/Round/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText(/Duration: 25 min/)).toBeInTheDocument();
  });

  it('reflects a different round and duration', () => {
    render(<RoundIndicator round={3} durationMinutes={5} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Duration: 5 min/)).toBeInTheDocument();
  });
});
