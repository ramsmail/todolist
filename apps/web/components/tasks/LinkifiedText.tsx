import { splitTextWithLinks, toHref } from '@todolist/core';

export function LinkifiedText({ text }: { text: string | null | undefined }) {
  const segments = splitTextWithLinks(text ?? '');
  return (
    <>
      {segments.map((segment, i) =>
        segment.type === 'link' ? (
          <a
            key={i}
            href={toHref(segment.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {segment.value}
          </a>
        ) : (
          <span key={i}>{segment.value}</span>
        )
      )}
    </>
  );
}
