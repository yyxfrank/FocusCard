import { useState, useEffect, useCallback } from 'react';
import Toolbar from './components/Toolbar/Toolbar.jsx';
import EditorPane from './components/Editor/EditorPane.jsx';
import PreviewPane from './components/Preview/PreviewPane.jsx';
import CardManager from './components/CardManager/CardManager.jsx';
import { useSupabase } from './hooks/useSupabase.js';
import './index.css';

function App() {
  const {
    loading,
    error: dbError,
    fetchDecks,
    createDeck,
    deleteDeck,
    createCard,
    fetchCards,
    deleteCard,
    updateCard,
  } = useSupabase();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [selectedDeckName, setSelectedDeckName] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Browsing / card management states ───────────────────────────
  const [browsing, setBrowsing] = useState(false);
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null); // null = creating new; set = editing existing

  // ── Transient UI feedback states ─────────────────────────────────
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error'|'validation', message }

  // ── Fetch decks on mount ─────────────────────────────────────────
  useEffect(() => {
    fetchDecks().then(setDecks);
  }, [fetchDecks]);

  // ── Deck selection ───────────────────────────────────────────────
  const handleSelectDeck = useCallback((id, name) => {
    setSelectedDeckId(id);
    setSelectedDeckName(name);
    setBrowsing(false);
    setFeedback(null);
  }, []);

  // ── Deck creation ────────────────────────────────────────────────
  const handleCreateDeck = useCallback(
    async (name) => {
      const deck = await createDeck(name);
      if (deck) {
        setDecks((prev) => [deck, ...prev]);
        setSelectedDeckId(deck.id);
        setSelectedDeckName(deck.name);
        setFeedback({ type: 'success', message: `Deck "${deck.name}" created` });
        setTimeout(() => setFeedback(null), 2500);
      }
    },
    [createDeck],
  );

  // ── Deck deletion ────────────────────────────────────────────────
  const handleDeleteDeck = useCallback(
    async (id) => {
      const success = await deleteDeck(id);
      if (success) {
        setDecks((prev) => prev.filter((d) => d.id !== id));
        if (selectedDeckId === id) {
          setSelectedDeckId(null);
          setSelectedDeckName('');
        }
        setFeedback({ type: 'success', message: 'Deck deleted' });
        setTimeout(() => setFeedback(null), 2500);
      }
    },
    [deleteDeck, selectedDeckId],
  );

  // ── Browse cards ─────────────────────────────────────────────────
  const handleBrowseCards = useCallback(() => {
    if (!selectedDeckId) return;
    setBrowsing(true);
    setCardsLoading(true);
    fetchCards(selectedDeckId).then((data) => {
      setCards(data);
      setCardsLoading(false);
    });
  }, [selectedDeckId, fetchCards]);

  // ── Edit card (populate editor from card list) ──────────────────
  const handleEditCard = useCallback((card) => {
    setFront(card.front || '');
    setBack(card.back || '');
    setEditingCardId(card.id);
    setBrowsing(false);
    setFeedback(null);
  }, []);

  // ── Delete card ──────────────────────────────────────────────────
  const handleDeleteCard = useCallback(
    async (id) => {
      const success = await deleteCard(id);
      if (success) {
        setCards((prev) => prev.filter((c) => c.id !== id));
        setFeedback({ type: 'success', message: 'Card deleted' });
        setTimeout(() => setFeedback(null), 2500);
      } else {
        setFeedback({ type: 'error', message: dbError || 'Failed to delete card' });
        setTimeout(() => setFeedback(null), 2500);
      }
    },
    [deleteCard, dbError],
  );

  // ── Card save (Cmd+Enter) ────────────────────────────────────────
  const handleSaveCard = useCallback(async () => {
    // Guard: no deck selected
    if (!selectedDeckId) {
      setFeedback({ type: 'validation', message: 'Select a deck first' });
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    // Guard: empty submission (TEST.md Phase 4 — Empty Submission Preventer)
    if (!front.trim() && !back.trim()) {
      setFeedback({ type: 'validation', message: 'Front or Back must not be empty' });
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    // Guard: spam-click preventer (TEST.md Phase 4 — Spam Click Preventer)
    if (saving) return;

    setSaving(true);
    setFeedback(null);

    let result;
    if (editingCardId) {
      result = await updateCard(editingCardId, { front, back });
    } else {
      result = await createCard(selectedDeckId, front, back);
    }
    setSaving(false);

    if (result) {
      setFront('');
      setBack('');
      setEditingCardId(null);
      setFeedback({ type: 'success', message: editingCardId ? 'Card updated' : 'Card saved' });
      setTimeout(() => setFeedback(null), 2000);
    } else if (dbError) {
      setFeedback({ type: 'error', message: dbError });
    } else {
      setFeedback({ type: 'error', message: 'Failed to save card' });
    }
  }, [selectedDeckId, front, back, saving, editingCardId, createCard, updateCard, dbError]);

  // ── Keyboard listener: Cmd+Enter / Ctrl+Enter ───────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveCard();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveCard]);

  // ── New Card button handler ──────────────────────────────────────
  const handleNewCard = useCallback(() => {
    if (!selectedDeckId) return;
    setFront('');
    setBack('');
    setEditingCardId(null);
    setFeedback(null);
  }, [selectedDeckId]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Toolbar
        streak={0}
        decks={decks}
        selectedDeckId={selectedDeckId}
        selectedDeck={selectedDeckName}
        onSelectDeck={handleSelectDeck}
        onCreateDeck={handleCreateDeck}
        onDeleteDeck={handleDeleteDeck}
        onNewCard={handleNewCard}
        onBrowseCards={handleBrowseCards}
        browsing={browsing}
        saving={saving}
      />

      {/* ── Feedback bar ─────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`px-4 py-1.5 text-xs font-medium text-center border-b transition-opacity ${
            feedback.type === 'success'
              ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : feedback.type === 'validation'
                ? 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Main content: CardManager (browsing) or Editor+Preview ── */}
      <main className="flex flex-1 overflow-hidden">
        {browsing ? (
          <section className="flex-1 flex flex-col">
            <CardManager
              cards={cards}
              deckName={selectedDeckName}
              onEditCard={handleEditCard}
              onDeleteCard={handleDeleteCard}
              onBack={() => setBrowsing(false)}
              loading={cardsLoading}
            />
          </section>
        ) : (
          <>
            <section className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
              <EditorPane
                front={front}
                back={back}
                onFrontChange={setFront}
                onBackChange={setBack}
                selectedDeckId={selectedDeckId}
                editingCardId={editingCardId}
                saving={saving}
              />
            </section>

            <section className="flex-1 flex flex-col">
              <PreviewPane front={front} back={back} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
