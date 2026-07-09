/**
 * FocusCards Web — EditorPane
 *
 * Left-hand input pane with two CodeMirror editors stacked vertically:
 * Front (top) and Back (bottom).  Each supports Markdown syntax highlighting.
 *
 * @module components/Editor/EditorPane
 */

import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';

// ── Shared CodeMirror extensions ───────────────────────────────────

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
];

// ── Sub-editor component ──────────────────────────────────────────

function EditorField({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 pt-3 pb-1.5 border-b border-gray-100 dark:border-gray-800">
        {label}
      </h2>
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          theme={oneDark}
          placeholder={placeholder}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          height="100%"
        />
      </div>
    </div>
  );
}

// ── Pane ────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {string}   [props.front]       — Front-side markdown content.
 * @param {string}   [props.back]        — Back-side markdown content.
 * @param {function} [props.onFrontChange] — Called with new front value.
 * @param {function} [props.onBackChange]  — Called with new back value.
 */
export default function EditorPane({
  front = '',
  back = '',
  onFrontChange,
  onBackChange,
}) {
  return (
    <div className="flex flex-col h-full">
      <EditorField
        label="Front"
        value={front}
        onChange={onFrontChange}
        placeholder="Type the question / prompt here…"
      />
      <div className="border-t border-gray-200 dark:border-gray-700" />
      <EditorField
        label="Back"
        value={back}
        onChange={onBackChange}
        placeholder="Type the answer / explanation here…"
      />
    </div>
  );
}
