'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content into the app's e-ink-styled preview pane.
 *
 * Plugins:
 *   - remark-gfm: GitHub-flavored markdown (tables, strikethrough, task lists,
 *     autolinks).
 *   - remark-breaks: Treats single newlines as <br> instead of joining into
 *     paragraphs. CRITICAL for lyrics — without this, lines like:
 *       [Verse 1]
 *       Line one
 *       Line two
 *     would render as a single paragraph "[Verse 1] Line one Line two".
 *
 * Uses the `.md-preview` CSS class scoped in globals.css.
 */
export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  return (
    <div className={`md-preview ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Open links in new tab so the user doesn't lose their writing
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
