/**
 * Persistently track which decks have been completed today.
 * Uses localStorage (web) so the "✓ Completed" badge survives page refreshes
 * but automatically resets the next day.
 */

const STORAGE_PREFIX = 'focuscards_completed_';

function getTodayKey(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${STORAGE_PREFIX}${today}`;
}

export function getCompletedDeckIds(): string[] {
  try {
    const raw = localStorage.getItem(getTodayKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function addCompletedDeckId(deckId: string): void {
  try {
    const ids = getCompletedDeckIds();
    if (ids.includes(deckId)) return;
    ids.push(deckId);
    localStorage.setItem(getTodayKey(), JSON.stringify(ids));
  } catch {
    // localStorage unavailable — silently ignore
  }
}
