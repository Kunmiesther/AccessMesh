"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export function MarkdownContent({
  markdown,
  className,
  emptyFallback,
}: {
  markdown: string;
  className?: string;
  emptyFallback?: React.ReactNode;
}) {
  const wrapperClassName = ["markdown-document", className]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={wrapperClassName}>
        {markdown.trim().length > 0 ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a: ({ node: _node, ...props }) => (
                <a {...props} target="_blank" rel="noreferrer" />
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        ) : (
          emptyFallback ?? null
        )}
      </div>
      <style jsx global>{`
        .markdown-document {
          color: var(--text-secondary);
          line-height: 1.8;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .markdown-document > *:first-child {
          margin-top: 0;
        }

        .markdown-document > *:last-child {
          margin-bottom: 0;
        }

        .markdown-document h1,
        .markdown-document h2,
        .markdown-document h3,
        .markdown-document h4,
        .markdown-document h5,
        .markdown-document h6 {
          color: var(--text-primary);
          line-height: 1.2;
          margin: 1.35em 0 0.65em;
          font-weight: 600;
        }

        .markdown-document h1 {
          font-size: 2rem;
        }

        .markdown-document h2 {
          font-size: 1.65rem;
        }

        .markdown-document h3 {
          font-size: 1.35rem;
        }

        .markdown-document h4 {
          font-size: 1.15rem;
        }

        .markdown-document p,
        .markdown-document ul,
        .markdown-document ol,
        .markdown-document blockquote,
        .markdown-document pre,
        .markdown-document table {
          margin: 0 0 1.1rem;
        }

        .markdown-document ul,
        .markdown-document ol {
          padding-left: 1.35rem;
        }

        .markdown-document li + li {
          margin-top: 0.35rem;
        }

        .markdown-document li > p {
          margin-bottom: 0.5rem;
        }

        .markdown-document strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        .markdown-document em {
          color: inherit;
        }

        .markdown-document a {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .markdown-document blockquote {
          border-left: 3px solid var(--border);
          padding: 0.1rem 0 0.1rem 1rem;
          color: var(--text-muted);
        }

        .markdown-document :not(pre) > code {
          font-family: var(--font-mono);
          font-size: 0.95em;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-subtle);
          padding: 0.12em 0.38em;
          border-radius: 4px;
        }

        .markdown-document pre {
          overflow-x: auto;
          background: #0a0a0a;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 16px;
        }

        .markdown-document pre code {
          font-family: var(--font-mono);
          background: transparent;
          border: 0;
          padding: 0;
          color: var(--text-primary);
        }

        .markdown-document img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 1.1rem 0;
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        .markdown-document hr {
          border: 0;
          border-top: 1px solid var(--border);
          margin: 1.5rem 0;
        }

        .markdown-document table {
          width: 100%;
          border-collapse: collapse;
          display: block;
          overflow-x: auto;
        }

        .markdown-document th,
        .markdown-document td {
          border: 1px solid var(--border);
          padding: 0.55rem 0.7rem;
          text-align: left;
        }

        .markdown-document th {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
        }

        @media (max-width: 640px) {
          .markdown-document {
            line-height: 1.75;
          }

          .markdown-document h1 {
            font-size: 1.7rem;
          }

          .markdown-document h2 {
            font-size: 1.45rem;
          }

          .markdown-document h3 {
            font-size: 1.22rem;
          }
        }
      `}</style>
    </>
  );
}
