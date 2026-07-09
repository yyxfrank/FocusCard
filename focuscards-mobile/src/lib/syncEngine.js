/**
 * FocusCards Mobile — Sync Engine
 *
 * Data-access layer for the Expo app.  Each function wraps a Supabase
 * query in try/catch and returns `{ data, error }`.
 *
 * The key mobile-specific query is `fetchDueCards`, which filters by
 * `next_review <= NOW()` and caps the result to `daily_review_limit`
 * cards per deck.
 *
 * @module lib/syncEngine
 */

import { supabase } from './supabase.js';

// ── Decks ────────────────────────────────────────────────────────────

/**
 * Fetch all decks, ordered newest first.
 * @returns {Promise<{ data: Array|null, error: string|null }>}
 */
export async function fetchDecks() {
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/**
 * Fetch a single deck by id.
 * @param {string} id
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function fetchDeck(id) {
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

// ── Cards ────────────────────────────────────────────────────────────

/**
 * Fetch due cards for a specific deck.
 *
 * The query is the mobile-specific filtered fetch:
 * - Only cards where `next_review <= NOW()` (due for review)
 * - Ordered by `next_review` ascending (most overdue first)
 * - Capped at `limit` (the deck's `daily_review_limit`)
 *
 * @param {string} deckId  — UUID of the deck.
 * @param {number} limit   — Maximum cards to return (deck.daily_review_limit).
 * @returns {Promise<{ data: Array|null, error: string|null }>}
 */
export async function fetchDueCards(deckId, limit) {
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/**
 * Fetch due cards across ALL decks, capped globally.
 *
 * Useful for the Dashboard to show a total "cards due" badge.
 *
 * @param {number} limit — Global max (e.g. 200).
 * @returns {Promise<{ data: Array|null, error: string|null }>}
 */
export async function fetchAllDueCards(limit = 200) {
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/**
 * Update a card's SRS fields in the database.
 * Used for the large-cycle write-back after review.
 *
 * @param {string} id      — Card UUID.
 * @param {object} updates — Fields to update (e.g. { interval_days, ease_factor, next_review }).
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function updateCard(id, updates) {
  try {
    const { data, error } = await supabase
      .from('cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

// ── Check-Ins & Streak ───────────────────────────────────────────────

/**
 * Fetch all check-ins, newest first.
 * @returns {Promise<{ data: Array|null, error: string|null }>}
 */
export async function fetchCheckIns() {
  try {
    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .order('check_in_date', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/**
 * Create a daily check-in.
 * @param {string} checkInDate — YYYY-MM-DD string.
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function createCheckIn(checkInDate) {
  try {
    const { data, error } = await supabase
      .from('check_ins')
      .insert({ check_in_date: checkInDate })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/**
 * Compute the current streak length from the check_ins table.
 *
 * Walks backwards from today counting consecutive dates.
 * A gap (missing date) breaks the streak.
 *
 * @returns {Promise<{ data: number, error: string|null }>}
 */
export async function computeStreak() {
  try {
    const { data, error } = await supabase
      .from('check_ins')
      .select('check_in_date')
      .order('check_in_date', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return { data: 0, error: null };

    let streak = 0;
    const today = new Date();
    let cursor = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    for (const row of data) {
      const rowDate = new Date(row.check_in_date + 'T00:00:00Z');
      const diff = Math.round((cursor - rowDate) / 86400000);

      if (diff === 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (diff === 1) {
        // Allow missing today if yesterday exists (streak continues from yesterday)
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return { data: streak, error: null };
  } catch (e) {
    return { data: 0, error: e.message };
  }
}
