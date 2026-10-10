/**
 * FocusCards Web — PreviewPane
 *
 * Right-hand pane that renders card front/back content as rendered
 * Markdown with KaTeX math and syntax-highlighted code blocks.
 *
 * @module components/Preview/PreviewPane
 */

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';

// ── Custom code-block renderer ──────────────────────────────────────

function CodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');
  return match ? (
    <SyntaxHighlighter
      style={oneDark}
      language={match[1]}
      PreTag="div"
      customStyle={{ margin: 0, background: '#09090b', borderRadius: '0.375rem', fontSize: '0.8125rem' }}
    >
      {code}
    </SyntaxHighlighter>
  ) : (
    <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm">
      {children}
    </code>
  );
}

// ── Shared Markdown config ──────────────────────────────────────────

const markdownPlugins = [[remarkMath, { singleDollarTextMath: true }], remarkGfm];
const rehypePlugins = [[rehypeKatex, { throwOnError: false }]];

const markdownComponents = {
  code: CodeBlock,
};

export function CardContent({ content = '' }) {
  return <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={rehypePlugins}
    components={markdownComponents}>{content}</ReactMarkdown>;
}

// ── Section sub-component ──────────────────────────────────────────

function PreviewSection({ label, content, emptyLabel }) {
  return (
    <section className="flex flex-col flex-1 overflow-hidden">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-4 pt-3 pb-1.5 border-b border-gray-100 dark:border-gray-800">
        {label}
      </h2>
      <div className="flex-1 overflow-y-auto px-4 py-3 text-gray-800 dark:text-gray-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
        {content ? (
          <ReactMarkdown
            remarkPlugins={markdownPlugins}
            rehypePlugins={rehypePlugins}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <span className="text-gray-300 dark:text-gray-600 italic select-none">
            {emptyLabel}
          </span>
        )}
      </div>
    </section>
  );
}

// ── Pane ────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string} props.front  — Front-side markdown/LaTeX content.
 * @param {string} props.back   — Back-side markdown/LaTeX content.
 */
export default function PreviewPane({ front = '', back = '' }) {
  return (
    <div className="flex flex-col h-full">
      <PreviewSection label="Front" content={front} emptyLabel="Type something in the editor…" />

      <div className="border-t border-gray-200 dark:border-gray-700" />

      <PreviewSection label="Back" content={back} emptyLabel="Back-side content will appear here…" />
    </div>
  );
}
