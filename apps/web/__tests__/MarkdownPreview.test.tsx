import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownPreview } from '@/components/notes/MarkdownPreview';

describe('MarkdownPreview', () => {
  it('renders emphasis', () => {
    const { container } = render(<MarkdownPreview source="say **hello**" />);
    expect(container.querySelector('strong')).toHaveTextContent('hello');
  });

  it('renders GFM task list items as checkboxes', () => {
    render(<MarkdownPreview source={'- [ ] call bank\n- [x] pay rent'} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('opens links in a new tab safely', () => {
    render(<MarkdownPreview source="[docs](https://example.com)" />);
    const a = screen.getByRole('link', { name: 'docs' });
    expect(a).toHaveAttribute('href', 'https://example.com');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('drops javascript: URLs', () => {
    render(<MarkdownPreview source="[x](javascript:alert(1))" />);
    const a = screen.getByText('x').closest('a');
    expect(a?.getAttribute('href') ?? '').toBe('');
  });

  it('does not render raw HTML', () => {
    const { container } = render(<MarkdownPreview source={'<b>bold</b><script>alert(1)</script>'} />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('shows a placeholder for an empty note', () => {
    render(<MarkdownPreview source="   " />);
    expect(screen.getByText('Nothing to preview')).toBeInTheDocument();
  });
});
