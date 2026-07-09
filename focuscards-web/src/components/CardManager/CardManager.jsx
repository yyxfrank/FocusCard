/**
 * FocusCards Web — CardManager
 *
 * Full-screen card list view for a selected deck.
 * Each card shows truncated front/back with Edit and Delete actions.
 *
 * @module components/CardManager/CardManager
 */

import { useState } from 'react';

/**
 * @param {object}   props
 * @param {Array}    props.cards        — List of card objects { id, front, back }.
 * @param {string}   props.deckName     — Name of the current deck.
 * @param {function} props.onEditCard   — Called with (card) to populate editor.
 * @param {function} props.onDeleteCard — Called with (id) to delete a card.
 * @param {function} props.onBack       — Called with no args to return to editor.
 * @param {boolean}  props.loading      — True while cards are being fetched.
 */
export default function CardManager({
  cards = [],
  deckName = '',
  onEditCard,
  onDeleteCard,
  onBack,
  loading,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    setDeletingId(id);
    await onDeleteCard(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {deckName || 'Cards'}
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </span>
      </div>

      {/* ── Card list ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            Loading cards…
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>No cards in this deck yet</span>
            <span className="mt-1 text-xs">Create one using the editor!</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex items-start gap-4 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group"
              >
                {/* Front */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                    Front
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {card.front || <span className="italic text-gray-300 dark:text-gray-600">(empty)</span>}
                  </div>
                </div>

                {/* Back */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                    Back
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {card.back || <span className="italic text-gray-300 dark:text-gray-600">(empty)</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-4">
                  <button
                    onClick={() => onEditCard(card)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-all cursor-pointer"
                    title="Edit card"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>

                  {confirmDeleteId === card.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(card.id)}
                        disabled={deletingId === card.id}
                        className="p-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-all cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === card.id ? '…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(card.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded transition-all cursor-pointer"
                      title="Delete card"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
