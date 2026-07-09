/**
 * FocusCards SRS Engine
 *
 * Pure functions for SM-2 Large Cycle interval calculations and
 * Intraday Session Queue (Small Cycle) evaluation.
 *
 * @module srsEngine
 */

/** Minimum ease factor after decrement */
const MIN_EASE_FACTOR = 1.3;

/** Interval (days) assigned when a card is Forgotten */
const FORGOTTEN_INTERVAL = 1;

/** Ease factor decrement applied when a card is Forgotten */
const FORGOTTEN_EASE_DECREMENT = 0.2;

/** Multiplier for Unfamiliar feedback */
const UNFAMILIAR_INTERVAL_MULTIPLIER = 1.2;

/** Minimum interval in days for any non-Forgotten outcome */
const MIN_INTERVAL = 1;

/**
 * Calculate the next SRS state for a card using SM-2 Large Cycle logic.
 *
 * This function should be called **once** per card per session, using the
 * *first* action the user took on that card. Subsequent within-session
 * actions (requeues) do not update the database.
 *
 * @param {number} intervalDays — Current `interval_days` from DB.
 * @param {number} easeFactor   — Current `ease_factor` from DB (default 2.5).
 * @param {'Forgotten' | 'Unfamiliar' | 'Familiar'} feedback — First session action.
 * @param {Date}   [now=new Date()] — Reference date for `next_review`.
 * @returns {{ intervalDays: number, easeFactor: number, nextReview: string }}
 *   Updated SRS state. `nextReview` is an ISO 8601 string.
 *
 * @example
 * calculateNextReview(5, 2.5, 'Familiar')
 * // => { intervalDays: 13, easeFactor: 2.5, nextReview: '2026-07-22T…' }
 *
 * @example
 * calculateNextReview(5, 2.5, 'Forgotten')
 * // => { intervalDays: 1, easeFactor: 2.3, nextReview: '2026-07-10T…' }
 *
 * @example
 * calculateNextReview(0, 2.5, 'Unfamiliar')
 * // => { intervalDays: 1, easeFactor: 2.5, nextReview: '2026-07-10T…' }
 */
export function calculateNextReview(
  intervalDays,
  easeFactor,
  feedback,
  now = new Date(),
) {
  let newIntervalDays;
  let newEaseFactor;

  switch (feedback) {
    case 'Forgotten':
      newIntervalDays = FORGOTTEN_INTERVAL;
      newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - FORGOTTEN_EASE_DECREMENT);
      break;

    case 'Unfamiliar':
      newIntervalDays = Math.max(
        MIN_INTERVAL,
        Math.round(intervalDays * UNFAMILIAR_INTERVAL_MULTIPLIER),
      );
      newEaseFactor = easeFactor;
      break;

    case 'Familiar':
      newIntervalDays = Math.max(
        MIN_INTERVAL,
        Math.round(intervalDays * easeFactor),
      );
      newEaseFactor = easeFactor;
      break;

    default:
      throw new Error(
        `Invalid feedback "${feedback}". Expected: Forgotten, Unfamiliar, or Familiar.`,
      );
  }

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + newIntervalDays);

  return {
    intervalDays: newIntervalDays,
    easeFactor: newEaseFactor,
    nextReview: nextReviewDate.toISOString(),
  };
}

/**
 * Evaluate whether a card should be requeued in the Intraday Session Queue.
 *
 * **Small Cycle rules:**
 * - `Forgotten` / `Unfamiliar` → requeue (card reappears later in the session).
 * - `Familiar`             → remove from the session queue permanently.
 *
 * @param {'Forgotten' | 'Unfamiliar' | 'Familiar'} feedback — User's self-assessment.
 * @returns {{ requeue: boolean }}
 *   `true`  → move card to back of queue.
 *   `false` → card is done for this session.
 *
 * @example
 * evaluateSessionAction('Forgotten')  // => { requeue: true }
 * evaluateSessionAction('Unfamiliar') // => { requeue: true }
 * evaluateSessionAction('Familiar')   // => { requeue: false }
 */
export function evaluateSessionAction(feedback) {
  switch (feedback) {
    case 'Forgotten':
    case 'Unfamiliar':
      return { requeue: true };

    case 'Familiar':
      return { requeue: false };

    default:
      throw new Error(
        `Invalid feedback "${feedback}". Expected: Forgotten, Unfamiliar, or Familiar.`,
      );
  }
}
