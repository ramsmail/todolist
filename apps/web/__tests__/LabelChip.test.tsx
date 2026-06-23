import { render, screen } from '@testing-library/react';
import { LabelChip } from '@/components/tasks/LabelChip';

describe('LabelChip', () => {
  it('renders the label name with a leading @', () => {
    render(<LabelChip name="groceries" color="#10B981" />);
    expect(screen.getByText('groceries')).toBeInTheDocument();
  });
});
