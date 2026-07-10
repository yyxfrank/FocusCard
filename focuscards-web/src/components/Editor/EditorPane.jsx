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
 * @param {string}   [props.front]            — Front-side markdown content.
 * @param {string}   [props.back]             — Back-side markdown content.
 * @param {function} [props.onFrontChange]     — Called with new front value.
 * @param {function} [props.onBackChange]      — Called with new back value.
 * @param {string}   [props.selectedDeckId]    — Currently selected deck id (null if none).
 * @param {string}   [props.editingCardId]     — Card id being edited (null if creating new).
 * @param {boolean}  [props.saving]            — True while a card save is in-flight.
 */
export default function EditorPane({
  front = '',
  back = '',
  onFrontChange,
  onBackChange,
  selectedDeckId,
  editingCardId,
  saving,
}) {
  return (
    <div className="flex flex-col h-full relative">
      {/* Save hint bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
        {editingCardId ? (
          <span className="text-blue-500 font-medium">Editing card</span>
        ) : (
          <span />
        )}
        {selectedDeckId ? (
          saving ? (
            <span className="text-blue-500">Saving…</span>
          ) : (
            <span>
              <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-[10px]">
                {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
              </kbd>{' '}
              to save
            </span>
          )
        ) : (
          <span className="text-amber-500">Select a deck to start creating cards</span>
        )}
      </div>

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
