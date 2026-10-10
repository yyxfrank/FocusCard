import { calculateNextReview, evaluateSessionAction } from './srsEngine.js';

// Match the mobile session: advance only after the first rating is persisted.
export async function commitSessionAction(card, feedback, writtenIds, persist) {
  if (!writtenIds.has(card.id)) {
    const next = calculateNextReview(card.interval_days ?? 0, card.ease_factor ?? 2.5, feedback);
    const result = await persist(card.id, {
      interval_days: next.intervalDays,
      ease_factor: next.easeFactor,
      next_review: next.nextReview,
    });
    if (result.error) throw new Error(result.error);
    writtenIds.add(card.id);
  }
  return evaluateSessionAction(feedback);
}
