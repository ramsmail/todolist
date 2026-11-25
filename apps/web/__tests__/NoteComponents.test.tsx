import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NoteRow } from '@/components/notes/NoteRow';
import { LinkPreviewCard } from '@/components/notes/LinkPreviewCard';
import { ConflictBanner } from '@/components/notes/ConflictBanner';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1', title: 'Weekly plan', body: 'first line\nsecond line', link_title: null, link_excerpt: null,
  link_image_url: null, link_site_name: null, source_url: null, link_status: null,
  is_archived: 0, is_processed: 0, project_id: null, labels: '[]', conflict_of: null,
  updated_at: '2026-11-25T10:00:00.000Z', ...over,
}) as any;

describe('NoteRow', () => {
  it('links to the note and shows its title and excerpt', () => {
    render(<NoteRow note={row()} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notes/n1');
    expect(screen.getByText('Weekly plan')).toBeInTheDocument();
    expect(screen.getByText('first line second line')).toBeInTheDocument();
  });

  it('falls back to the first body line when there is no title', () => {
    render(<NoteRow note={row({ title: '', body: '## Big idea\nmore' })} />);
    expect(screen.getByText('Big idea')).toBeInTheDocument();
  });

  it('shows site name, project chip and label chips', () => {
    render(
      <NoteRow
        note={row({ link_site_name: 'Example', labels: '["work"]' })}
        project={{ name: 'Home', color: '#10B981' }}
        labelColor={() => '#6366F1'}
      />
    );
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('badges conflict copies and archived notes', () => {
    render(<NoteRow note={row({ conflict_of: 'orig', is_archived: 1 })} />);
    expect(screen.getByText('Conflict copy')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('renders a thumbnail only for a safe http(s) image url', () => {
    const { container, rerender } = render(<NoteRow note={row({ link_image_url: 'https://x.com/a.jpg' })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x.com/a.jpg');
    rerender(<NoteRow note={row({ link_image_url: 'javascript:alert(1)' })} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('LinkPreviewCard', () => {
  const base = { url: 'https://example.com/a', title: 'An article', excerpt: 'Summary text', imageUrl: null, siteName: 'Example', status: 'ok' };

  it('shows title, site, excerpt and an Open link when enriched', () => {
    render(<LinkPreviewCard {...base} />);
    expect(screen.getByText('An article')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Summary text')).toBeInTheDocument();
    const open = screen.getByRole('link', { name: 'Open' });
    expect(open).toHaveAttribute('href', 'https://example.com/a');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows a skeleton while pending', () => {
    render(<LinkPreviewCard {...base} title={null} status="pending" />);
    expect(screen.getByRole('status', { name: 'Loading link preview' })).toBeInTheDocument();
  });

  it('falls back to the bare url when enrichment failed', () => {
    render(<LinkPreviewCard {...base} title={null} status="failed" />);
    const link = screen.getByRole('link', { name: 'https://example.com/a' });
    expect(link).toHaveAttribute('href', 'https://example.com/a');
  });

  it('renders nothing for a missing or unsafe url', () => {
    const { container, rerender } = render(<LinkPreviewCard {...base} url={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LinkPreviewCard {...base} url="javascript:alert(1)" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ConflictBanner', () => {
  it('names the original and offers both actions', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<ConflictBanner originalTitle="Plan" hasOriginal onOpenOriginal={onOpen} onDeleteCopy={onDelete} />);
    expect(screen.getByText(/Conflict copy of/)).toHaveTextContent('Plan');
    fireEvent.click(screen.getByRole('button', { name: 'Open original' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete copy' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('hides Open original when the original no longer exists', () => {
    render(<ConflictBanner originalTitle={null} hasOriginal={false} onOpenOriginal={vi.fn()} onDeleteCopy={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open original' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete copy' })).toBeInTheDocument();
  });
});
