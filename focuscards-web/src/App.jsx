import Toolbar from './components/Toolbar/Toolbar.jsx';
import './index.css';

function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <Toolbar streak={0} />

      {/* ── Main content: Editor (left) + Preview (right) ──────── */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left pane — Text Editor (Task 3.3) */}
        <section className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center flex-1 text-gray-400 dark:text-gray-600 text-sm">
            Editor — Front / Back
          </div>
        </section>

        {/* Right pane — Markdown Preview (Task 3.2) */}
        <section className="flex-1 flex flex-col">
          <div className="flex items-center justify-center flex-1 text-gray-400 dark:text-gray-600 text-sm">
            Preview — KaTeX / Markdown
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
