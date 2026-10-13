import { useState, useEffect, useCallback } from 'react';
import Toolbar from './components/Toolbar/Toolbar.jsx';
import EditorPane from './components/Editor/EditorPane.jsx';
import PreviewPane from './components/Preview/PreviewPane.jsx';
import CardManager from './components/CardManager/CardManager.jsx';
import ReviewPane from './components/Review/ReviewPane.jsx';
import UserProfile from './components/UserProfile/UserProfile.jsx';
import { streakFromDates } from './utils/calendar.js';
import { useSupabase } from './hooks/useSupabase.js';
import { supabase } from './lib/supabase.js';
import { splitCodeExample } from './utils/codeExample.js';
import './index.css';

function App({ user }) {
  const {
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
  const [reviewing, setReviewing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState(user.user_metadata?.username || '');
  const [streak, setStreak] = useState(0);
  const refreshStreak = useCallback(async () => {
    const { data, error } = await supabase.from('check_ins').select('check_in_date').order('check_in_date', { ascending: false }).limit(400);
    if (!error) setStreak(streakFromDates(data ?? []));
  }, []);
  useEffect(() => { void refreshStreak(); }, [refreshStreak]);

  // ── Browsing / card management states ───────────────────────────
  const [browsing, setBrowsing] = useState(false);
  const [browseFromProfile, setBrowseFromProfile] = useState(false);
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null); // null = creating new; set = editing existing
  const [dirty, setDirty] = useState(false); // true when editor has unsaved changes

  // ── Transient UI feedback states ─────────────────────────────────
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error'|'validation', message }

  // ── Fetch decks on mount ─────────────────────────────────────────
  useEffect(() => {
    fetchDecks().then(setDecks);
  }, [fetchDecks]);

  // ── Deck selection ───────────────────────────────────────────────
  const handleSelectDeck = useCallback((id, name) => {
    if (saving || id === selectedDeckId) return;
    if (dirty && !window.confirm('Discard unsaved changes and switch decks?')) return;
    setFront('');
    setBack('');
    setEditingCardId(null);
    setDirty(false);
    setCards([]);
    setSelectedDeckId(id);
    setSelectedDeckName(name);
    setBrowsing(false);
    setFeedback(null);
  }, [saving, dirty, selectedDeckId]);

  // ── Deck creation ────────────────────────────────────────────────
  const handleCreateDeck = useCallback(
    async (name) => {
      if (saving || (dirty && !window.confirm('Discard unsaved changes and create a deck?'))) return;
      const deck = await createDeck(name);
      if (deck) {
        setFront('');
        setBack('');
        setEditingCardId(null);
        setDirty(false);
        setBrowsing(false);
        setCards([]);
        setDecks((prev) => [deck, ...prev.filter((item) => item.id !== deck.id)]);
        setSelectedDeckId(deck.id);
        setSelectedDeckName(deck.name);
        setFeedback({ type: 'success', message: `Deck "${deck.name}" created` });
        setTimeout(() => setFeedback(null), 2500);
      }
    },
    [createDeck, saving, dirty],
  );

  // ── Deck deletion ────────────────────────────────────────────────
  const handleDeleteDeck = useCallback(
    async (id) => {
      const success = await deleteDeck(id);
      if (success) {
        setDecks((prev) => prev.filter((d) => d.id !== id));
        if (selectedDeckId === id) {
          setFront('');
          setBack('');
          setEditingCardId(null);
          setDirty(false);
          setBrowsing(false);
          setCards([]);
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
    setBrowseFromProfile(false);
    setBrowsing(true);
  }, [selectedDeckId]);

  useEffect(() => {
    if (!browsing || !selectedDeckId || profileOpen) return;
    let active = true;
    setCardsLoading(true);
    fetchCards(selectedDeckId).then((data) => {
      if (!active) return;
      setCards(data);
      setCardsLoading(false);
    });
    return () => { active = false; };
  }, [browsing, selectedDeckId, fetchCards, profileOpen]);

  const handleOverviewLoaded = useCallback((overview) => {
    setDecks(overview.decks);
    setStreak(overview.streak);
    setProfileUsername(overview.username || '');
  }, []);

  const handleProfileDeckAction = useCallback((deck, action) => {
    if (saving) return;
    if (dirty && !window.confirm('当前闪卡有未保存的修改，是否放弃修改并打开卡包？')) return;
    setFront('');
    setBack('');
    setEditingCardId(null);
    setDirty(false);
    setFeedback(null);
    setCards([]);
    setSelectedDeckId(deck.id);
    setSelectedDeckName(deck.name);
    setBrowsing(action === 'browse');
    setBrowseFromProfile(action === 'browse');
    setReviewing(action === 'review');
    // A review launched from the account page returns to that page.
    setProfileOpen(action === 'review');
  }, [saving, dirty]);

  useEffect(() => {
    let active = true;
    const channel = supabase.channel('web-card-manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decks' }, () => {
        fetchDecks().then((data) => { if (active) setDecks(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
        if (selectedDeckId && browsing && !profileOpen) {
          fetchCards(selectedDeckId).then((data) => { if (active) setCards(data); });
        }
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [fetchDecks, fetchCards, selectedDeckId, browsing, profileOpen]);

  // ── Editor content change handlers ──────────────────────────────
  const handleFrontChange = useCallback((value) => {
    setFront(value);
    setDirty(true);
  }, []);

  const handleBackChange = useCallback((value) => {
    setBack(value);
    setDirty(true);
  }, []);

  // ── Edit card (populate editor from card list) ──────────────────
  const handleEditCard = useCallback((card) => {
    setFront(card.front || '');
    setBack(card.back || '');
    setEditingCardId(card.id);
    setDirty(false);
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

    // Guard: Front and Back must both be non-empty
    const hasContent = (value) => {
      const example = splitCodeExample(value);
      return Boolean(example.text.trim() || (example.enabled && example.code.trim()));
    };
    if (!hasContent(front) || !hasContent(back)) {
      setFeedback({ type: 'validation', message: 'Both Front and Back must not be empty' });
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
      setDirty(false);
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
      if (reviewing || profileOpen || browsing) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveCard();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveCard, reviewing, profileOpen, browsing]);

  // ── New Card button handler ──────────────────────────────────────
  const handleNewCard = useCallback(() => {
    if (!selectedDeckId) return;
    if (dirty) {
      setFeedback({ type: 'validation', message: 'Please save or discard current changes first' });
      setTimeout(() => setFeedback(null), 2500);
      return;
    }
    setFront('');
    setBack('');
    setEditingCardId(null);
    setDirty(false);
    setFeedback(null);
  }, [selectedDeckId, dirty]);

  // ── Render ───────────────────────────────────────────────────────
  if (reviewing) return <ReviewPane deckId={selectedDeckId} onCompleted={refreshStreak}
    closeLabel={profileOpen ? '返回用户信息' : 'Back to editor'}
    onClose={() => { setReviewing(false); void refreshStreak(); }} />;

  if (profileOpen) return <UserProfile user={user} onBack={() => setProfileOpen(false)}
    onDeckAction={handleProfileDeckAction} onOverviewLoaded={handleOverviewLoaded} />;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <Toolbar
        username={profileUsername || user.email || '用户'}
        onOpenProfile={() => setProfileOpen(true)}
        streak={streak}
        decks={decks}
        selectedDeckId={selectedDeckId}
        selectedDeck={selectedDeckName}
        onSelectDeck={handleSelectDeck}
        onCreateDeck={handleCreateDeck}
        onDeleteDeck={handleDeleteDeck}
        onNewCard={handleNewCard}
        onBrowseCards={handleBrowseCards}
        onReview={() => { if (!saving && selectedDeckId) setReviewing(true); }}
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
              backLabel={browseFromProfile ? '返回用户信息' : 'Back'}
              onBack={() => { setBrowsing(false); if (browseFromProfile) setProfileOpen(true); }}
              loading={cardsLoading}
            />
          </section>
        ) : (
          <>
            <section className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
              <EditorPane
                front={front}
                back={back}
                onFrontChange={handleFrontChange}
                onBackChange={handleBackChange}
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
