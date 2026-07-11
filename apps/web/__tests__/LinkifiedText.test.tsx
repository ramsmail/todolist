import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LinkifiedText } from '@/components/tasks/LinkifiedText';

describe('LinkifiedText', () => {
  it('renders plain text with no URL as-is', () => {
    render(<LinkifiedText text="Buy milk" />);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a URL as a clickable link opening in a new tab', () => {
    render(<LinkifiedText text="See https://example.com/path for details" />);
    const link = screen.getByRole('link', { name: 'https://example.com/path' });
    expect(link).toHaveAttribute('href', 'https://example.com/path');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders surrounding text alongside the link', () => {
    render(<LinkifiedText text="See https://example.com for details" />);
    expect(screen.getByText(/See/)).toBeInTheDocument();
    expect(screen.getByText(/for details/)).toBeInTheDocument();
  });

  it('renders a scheme-less www. domain as a link pointing to https', () => {
    render(<LinkifiedText text="Check www.cnn.com now" />);
    const link = screen.getByRole('link', { name: 'www.cnn.com' });
    expect(link).toHaveAttribute('href', 'https://www.cnn.com');
  });
});
