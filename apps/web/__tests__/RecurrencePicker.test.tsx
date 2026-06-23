import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { RecurrencePicker } from '@/components/tasks/RecurrencePicker';

describe('RecurrencePicker', () => {
  it('shows current rule summary', () => {
    render(<RecurrencePicker value="FREQ=DAILY" onChange={() => {}} />);
    expect(screen.getAllByText('Every day')).toHaveLength(2);
  });

  it('emits a serialized rule when a preset is picked', () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'FREQ=MONTHLY' } });
    expect(onChange).toHaveBeenCalledWith('FREQ=MONTHLY');
  });

  it('emits null for None', () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value="FREQ=DAILY" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
