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
import { useEffect, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { splitCodeExample, joinCodeExample } from '../../utils/codeExample.js';
import { useWebTheme } from '../../hooks/useWebTheme.js';

const codeLanguages = [
  ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['python', 'Python'],
  ['java', 'Java'], ['cpp', 'C++'], ['c', 'C'], ['csharp', 'C#'],
  ['go', 'Go'], ['rust', 'Rust'], ['sql', 'SQL'], ['html', 'HTML'],
  ['css', 'CSS'], ['json', 'JSON'], ['php', 'PHP'], ['ruby', 'Ruby'],
];
const blackEditor = EditorView.theme({
  '&': { backgroundColor: '#09090b' },
  '.cm-gutters': { backgroundColor: '#09090b' },
});

function CodeEditor({ language, code, onChange }) {
  const [support, setSupport] = useState([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    setSupport([]);
    setLoadError(false);
    const name = codeLanguages.find(([id]) => id === language)?.[1] ?? language;
    const description = languages.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (description) description.load().then((extension) => {
      if (active) setSupport([extension]);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [language]);
  return <>
    {loadError && <p className="text-xs text-amber-500">Language support could not load. Reload to retry.</p>}
    <CodeMirror value={code} onChange={onChange} extensions={[...support, blackEditor]}
      theme={oneDark} minHeight="160px" maxHeight="320px" indentWithTab
      placeholder="Add a code example…"
      basicSetup={{ lineNumbers: true, closeBrackets: true, bracketMatching: true,
        indentOnInput: true, autocompletion: true, foldGutter: true }} />
  </>;
}

// ── Shared CodeMirror extensions ───────────────────────────────────

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
];

// ── Sub-editor component ──────────────────────────────────────────

function EditorField({ label, value, onChange, placeholder }) {
  const { theme } = useWebTheme();
  const example = splitCodeExample(value);
  const change = (updates) => onChange(joinCodeExample({ ...example, ...updates }));
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</h2>
        <label className="text-xs text-gray-500 flex gap-2 items-center">
          <input type="checkbox" checked={example.enabled} onChange={(event) => {
            if (!event.target.checked && example.code && !window.confirm('Remove this code example?')) return;
            change({ enabled: event.target.checked });
          }} />Code mode
        </label>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <CodeMirror
          value={example.text}
          onChange={(text) => change({ text })}
          extensions={extensions}
          theme={theme === 'dark' ? oneDark : 'light'}
          placeholder={placeholder}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          minHeight={example.enabled ? '120px' : '180px'}
        />
        {example.enabled && <div className="code-example-editor bg-black p-3">
          <label className="flex gap-2 items-center text-xs text-gray-300 mb-2">
            Language
            <select aria-label={`${label} code language`} value={example.language}
              onChange={(event) => change({ language: event.target.value })}
              className="bg-gray-900 text-white border border-gray-700 rounded px-2 py-1">
              {!codeLanguages.some(([id]) => id === example.language) && <option value={example.language}>{example.language}</option>}
              {codeLanguages.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <CodeEditor language={example.language} code={example.code} onChange={(code) => change({ code })} />
        </div>}
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
