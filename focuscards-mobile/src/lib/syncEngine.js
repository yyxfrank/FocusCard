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
import { streakFromDates } from '../utils/calendar.js';

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

/**
 * Update a deck's fields (e.g. daily_review_limit).
 * @param {string} id      — Deck UUID.
 * @param {object} updates — Fields to update (e.g. { daily_review_limit }).
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function updateDeck(id, updates) {
  try {
    const { data, error } = await supabase
      .from('decks')
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
    const reviewed = await fetchDailyReviewCount(deckId);
    if (reviewed.error) throw new Error(reviewed.error);
    const remaining = Math.max(0, limit - reviewed.data);
    if (remaining === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })
      .limit(remaining);

    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

/**
 * Fetch due cards across all decks using pagination.
 *
 * Useful for the Dashboard to show a total "cards due" badge.
 *
 * @returns {Promise<{ data: Array|null, error: string|null }>}
 */
export async function fetchAllDueCards() {
  try {
    const cards = [];
    const now = new Date().toISOString();
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('cards')
        .select('id, deck_id').lte('next_review', now)
        .order('id', { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) throw error;
      cards.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return { data: cards, error: null };
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
      .rpc('record_review', {
        p_card_id: id,
        p_interval_days: updates.interval_days,
        p_ease_factor: updates.ease_factor,
        p_next_review: updates.next_review,
      });

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
      .upsert({ check_in_date: checkInDate }, { onConflict: 'user_id,check_in_date' })
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

    return { data: streakFromDates(data), error: null };
  } catch (e) {
    return { data: 0, error: e.message };
  }
}

export async function countDueCards(deckId) {
  try {
    const { count, error } = await supabase.from('cards')
      .select('id', { count: 'exact', head: true }).eq('deck_id', deckId)
      .lte('next_review', new Date().toISOString());
    return { data: count ?? 0, error: error?.message ?? null };
  } catch (e) { return { data: 0, error: e.message }; }
}

export async function fetchDailyReviewCount(deckId) {
  try {
    const { data, error } = await supabase.rpc('get_daily_review_count', { p_deck_id: deckId });
    return { data: Number(data ?? 0), error: error?.message ?? null };
  } catch (e) { return { data: 0, error: e.message }; }
}

export async function fetchDueCounts() {
  try {
    const { data, error } = await supabase.rpc('get_due_counts');
    return { data, error: error?.message ?? null };
  } catch (e) { return { data: null, error: e.message }; }
}

export function subscribeToChanges(onChange) {
  const channel = supabase.channel(`mobile-${Math.random()}`);
  for (const table of ['decks', 'cards', 'check_ins']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  }
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
