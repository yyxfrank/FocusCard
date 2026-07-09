/**
 * FocusCards Web — useSupabase Hook
 *
 * React hook providing Deck / Card / CheckIn CRUD operations
 * against the Supabase PostgreSQL database.
 *
 * All Supabase interactions are wrapped in try/catch per the
 * architecture guidelines.  Failures set an `error` string and
 * return a fallback value — they never crash the React tree.
 *
 * @module hooks/useSupabase
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

// ── Default SRS values for new cards ────────────────────────────────

const DEFAULT_INTERVAL_DAYS = 0;
const DEFAULT_EASE_FACTOR = 2.5;

// ── Hook ────────────────────────────────────────────────────────────

export function useSupabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Decks ───────────────────────────────────────────────────────

  /** Fetch all decks, newest first. */
  const fetchDecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('decks')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Create a new deck. */
  const createDeck = useCallback(async (name, dailyReviewLimit = 50) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('decks')
        .insert({ name, daily_review_limit: dailyReviewLimit })
        .select()
        .single();

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /** Delete a deck (cards cascade-deleted by the DB). */
  const deleteDeck = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('decks')
        .delete()
        .eq('id', id);

      if (err) throw err;
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /** Update a deck's fields (e.g. name, daily_review_limit). */
  const updateDeck = useCallback(async (id, updates) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('decks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Cards ───────────────────────────────────────────────────────

  /** Fetch all cards for a given deck. */
  const fetchCards = useCallback(async (deckId) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: true });

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Create a new card. */
  const createCard = useCallback(
    async (deckId, front, back) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('cards')
          .insert({
            deck_id: deckId,
            front,
            back,
            interval_days: DEFAULT_INTERVAL_DAYS,
            ease_factor: DEFAULT_EASE_FACTOR,
            next_review: new Date().toISOString(),
          })
          .select()
          .single();

        if (err) throw err;
        return data;
      } catch (e) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Delete a single card by id. */
  const deleteCard = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('cards')
        .delete()
        .eq('id', id);

      if (err) throw err;
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update a card's fields.
   * Used by the SRS engine write-back to persist
   * interval_days, ease_factor, and next_review.
   */
  const updateCard = useCallback(async (id, updates) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Check-Ins ───────────────────────────────────────────────────

  /** Fetch all check-ins, newest first. */
  const fetchCheckIns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('check_ins')
        .select('*')
        .order('check_in_date', { ascending: false });

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Insert a check-in for a specific date. */
  const createCheckIn = useCallback(async (checkInDate) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('check_ins')
        .insert({ check_in_date: checkInDate })
        .select()
        .single();

      if (err) throw err;
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Public API ──────────────────────────────────────────────────

  return {
    loading,
    error,

    // Decks
    fetchDecks,
    createDeck,
    deleteDeck,
    updateDeck,

    // Cards
    fetchCards,
    createCard,
    deleteCard,
    updateCard,

    // Check-Ins
    fetchCheckIns,
    createCheckIn,
  };
}
