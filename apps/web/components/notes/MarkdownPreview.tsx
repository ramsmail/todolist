'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// react-markdown passes the hast `node` to every override; it must not reach the DOM.
function strip<T extends { node?: unknown }>({ node, ...rest }: T) {
  void node;
  return rest;
}

const components: Components = {
  a: (p) => <a {...strip(p)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" />,
  h1: (p) => <h1 {...strip(p)} className="text-xl font-bold mt-4 mb-2" />,
  h2: (p) => <h2 {...strip(p)} className="text-lg font-semibold mt-4 mb-2" />,
  h3: (p) => <h3 {...strip(p)} className="font-semibold mt-3 mb-1" />,
  ul: (p) => <ul {...strip(p)} className="list-disc pl-5 space-y-1" />,
  ol: (p) => <ol {...strip(p)} className="list-decimal pl-5 space-y-1" />,
  blockquote: (p) => <blockquote {...strip(p)} className="border-l-2 border-border pl-3 text-text-secondary" />,
  code: (p) => <code {...strip(p)} className="font-mono text-xs bg-surface-alt px-1 py-0.5 rounded" />,
  pre: (p) => <pre {...strip(p)} className="font-mono text-xs bg-surface-alt p-3 rounded-lg overflow-x-auto" />,
};

export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-text-muted text-sm">Nothing to preview</p>;
  }
  return (
    <div className="text-text-primary text-sm leading-relaxed space-y-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
