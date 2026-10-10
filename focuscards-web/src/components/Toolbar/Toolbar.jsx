/**
 * FocusCards Web — Toolbar
 *
 * Top navigation bar with branding, deck selector (dropdown with
 * list / create / delete), "New Card" button, and streak counter.
 *
 * @module components/Toolbar/Toolbar
 */

import { useState, useRef, useEffect } from 'react';

/**
 * @param {object}   props
 * @param {number}   [props.streak]           — Current streak count.
 * @param {Array}    [props.decks]            — List of deck objects { id, name, ... }.
 * @param {string}   [props.selectedDeckId]   — Currently selected deck id.
 * @param {string}   [props.selectedDeck]     — Currently selected deck name.
 * @param {function} [props.onSelectDeck]     — Called with (id, name) when a deck is picked.
 * @param {function} [props.onCreateDeck]     — Called with (name) to create a new deck.
 * @param {function} [props.onDeleteDeck]     — Called with (id) to delete a deck.
 * @param {function} [props.onNewCard]        — Click handler for New Card button.
 * @param {function} [props.onBrowseCards]    — Click handler for Browse Cards button.
 * @param {boolean}  [props.browsing]         — True while card list is displayed.
 * @param {boolean}  [props.saving]           — True while a card save is in-flight.
 */
export default function Toolbar({
  streak,
  decks = [],
  selectedDeckId,
  selectedDeck,
  onSelectDeck,
  onCreateDeck,
  onDeleteDeck,
  onNewCard,
  onBrowseCards,
  onReview,
  browsing,
  saving,
}) {
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!deckDropdownOpen) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDeckDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [deckDropdownOpen]);

  // ── Create deck helpers ──────────────────────────────────────────

  const handleCreate = () => {
    const name = newDeckName.trim();
    if (!name) return;
    onCreateDeck(name);
    setNewDeckName('');
  };

  const handleCreateKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none">
      {/* ── Left: Branding + Deck selector ────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
          FocusCards
        </h1>

        {/* Deck selector button + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDeckDropdownOpen(!deckDropdownOpen)}
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

          {deckDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              {/* Deck list */}
              <div className="max-h-48 overflow-y-auto">
                {decks.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 italic text-center">
                    No decks yet
                  </div>
                ) : (
                  decks.map((deck) => (
                    <div
                      key={deck.id}
                      className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer
                        hover:bg-gray-100 dark:hover:bg-gray-700
                        ${
                          deck.id === selectedDeckId
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      onClick={() => {
                        onSelectDeck(deck.id, deck.name);
                        setDeckDropdownOpen(false);
                      }}
                    >
                      <span className="truncate">{deck.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDeck(deck.id);
                        }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                        title="Delete deck"
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
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Create deck input */}
              <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex gap-2">
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder="New deck name…"
                  className="flex-1 text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                             bg-transparent text-gray-900 dark:text-gray-100
                             outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newDeckName.trim()}
                  className="text-sm px-2.5 py-1 bg-blue-600 text-white rounded
                             hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Actions ───────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <button onClick={onReview} disabled={!selectedDeckId || saving}
          className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white disabled:opacity-40">Review</button>
        {selectedDeckId && (
          <button
            onClick={onBrowseCards}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              browsing
                ? 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
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
                d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
              />
            </svg>
            Cards
          </button>
        )}
        <button
          onClick={onNewCard}
          disabled={!selectedDeckId || saving}
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

      {/* ── Right: Streak counter ─────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium">
          <span>🔥</span>
          <span>{streak !== undefined ? streak : '—'}</span>
        </span>
      </div>
    </header>
  );
}
