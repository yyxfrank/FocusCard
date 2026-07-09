/**
 * FocusCards Web — Toolbar
 *
 * Top navigation bar with branding, deck selector placeholder,
 * action buttons, and streak counter.
 *
 * @module components/Toolbar/Toolbar
 */

import { useState } from 'react';

/**
 * @param {object}   props
 * @param {number}   [props.streak] — Current streak count (0 if none).
 * @param {string}   [props.selectedDeck] — Currently active deck name.
 * @param {function} [props.onNewCard] — Click handler for New Card button.
 * @param {function} [props.onSelectDeck] — Click handler for deck selector.
 */
export default function Toolbar({
  streak,
  selectedDeck,
  onNewCard,
  onSelectDeck,
}) {
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none">
      {/* ── Left: Branding ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
          FocusCards
        </h1>

        {/* Deck selector placeholder */}
        <div className="relative">
          <button
            onClick={() => {
              setDeckDropdownOpen(!deckDropdownOpen);
              onSelectDeck?.();
            }}
            onBlur={() => setDeckDropdownOpen(false)}
            className="flex items-center gap-1.5 px-3 py-1 text-sm rounded-md
                       text-gray-600 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-800
                       border border-transparent hover:border-gray-300 dark:hover:border-gray-600
                       transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
            <span>{selectedDeck || 'Select Deck...'}</span>
          </button>
        </div>
      </div>

      {/* ── Center: Actions ──────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* New Card (placeholder — wired in Phase 4) */}
        <button
          onClick={onNewCard}
          disabled={!selectedDeck}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
                     text-white bg-blue-600 hover:bg-blue-700
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Card
        </button>
      </div>

      {/* ── Right: Streak Counter ──────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium">
          <span>🔥</span>
          <span>{streak !== undefined ? streak : '—'}</span>
        </span>
      </div>
    </header>
  );
}
