export type TextSegment = { type: 'text'; value: string } | { type: 'link'; value: string };

const URL_PATTERN = /https?:\/\/\S+|\bwww\.\S+/gi;

/** Splits free text into alternating text/link segments for clickable rendering. */
export function splitTextWithLinks(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({ type: 'link', value: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

/** A linkified segment's matched text may lack a scheme (e.g. "www.cnn.com") — add one so it's a valid URL to open. */
export function toHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
