import { useState } from 'react';
import Toolbar from './components/Toolbar/Toolbar.jsx';
import EditorPane from './components/Editor/EditorPane.jsx';
import PreviewPane from './components/Preview/PreviewPane.jsx';
import './index.css';

function App() {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <Toolbar streak={0} />

      {/* ── Main content: Editor (left) + Preview (right) ──────── */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left pane — Text Editor */}
        <section className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <EditorPane
            front={front}
            back={back}
            onFrontChange={setFront}
            onBackChange={setBack}
          />
        </section>

        {/* Right pane — Markdown Preview */}
        <section className="flex-1 flex flex-col">
          <PreviewPane front={front} back={back} />
        </section>
      </main>
    </div>
  );
}

export default App;
