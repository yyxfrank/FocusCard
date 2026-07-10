import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type MarkdownContentProps = {
  children: string;
  style?: Record<string, any>;
};

export function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginTop: 0,
              marginBottom: 6,
            }}
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginTop: 0,
              marginBottom: 4,
            }}
          >
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p style={{ margin: 0, marginBottom: 8 }}>{children}</p>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                style={{
                  backgroundColor: '#E8E8ED',
                  fontFamily: 'monospace',
                  fontSize: 16,
                  padding: '0 4px',
                  borderRadius: 4,
                }}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <pre
              style={{
                backgroundColor: '#E8E8ED',
                fontFamily: 'monospace',
                fontSize: 14,
                padding: 12,
                borderRadius: 8,
                margin: '8px 0',
                overflow: 'auto',
              }}
            >
              <code {...props}>{children}</code>
            </pre>
          );
        },
        ul: ({ children }) => (
          <ul style={{ margin: 0, marginBottom: 8, paddingLeft: 24 }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: 0, marginBottom: 8, paddingLeft: 24 }}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote
            style={{
              borderLeft: '4px solid #D1D5DB',
              margin: '8px 0',
              paddingLeft: 12,
              color: '#6B7280',
            }}
          >
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700 }}>{children}</strong>
        ),
        em: ({ children }) => <em>{children}</em>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
