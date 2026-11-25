'use client';

import { extractSoleUrl } from '@todolist/core';

interface Props {
  url: string | null;
  title: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  siteName: string | null;
  status: string | null;
}

export function LinkPreviewCard({ url, title, excerpt, imageUrl, siteName, status }: Props) {
  const href = extractSoleUrl(url ?? '');
  if (!href) return null;

  if (status === 'pending') {
    return (
      <div
        role="status"
        aria-label="Loading link preview"
        className="flex gap-3 border border-border rounded-xl p-3 animate-pulse"
      >
        <div className="w-16 h-16 rounded-lg bg-surface-alt" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-surface-alt" />
          <div className="h-3 w-full rounded bg-surface-alt" />
        </div>
      </div>
    );
  }

  if (status === 'failed' || !title) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent text-sm hover:underline break-all">
        {href}
      </a>
    );
  }

  const image = extractSoleUrl(imageUrl ?? '');
  return (
    <div className="flex gap-3 border border-border rounded-xl p-3 bg-surface">
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        {siteName && <p className="text-xs text-text-muted">{siteName}</p>}
        <p className="text-text-primary text-sm font-semibold">{title}</p>
        {excerpt && <p className="text-text-secondary text-xs mt-1 line-clamp-2">{excerpt}</p>}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-accent text-xs hover:underline"
        >
          Open
        </a>
      </div>
    </div>
  );
}
