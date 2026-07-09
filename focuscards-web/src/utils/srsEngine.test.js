/**
 * Unit tests for the FocusCards SRS Engine.
 *
 * Covers Phase 2 of TEST.md:
 * - SM-2 interval calculations (all 3 feedback types)
 * - Minimum ease floor boundary
 * - Session queue boundary (invalid/null input)
 *
 * Run: `node src/utils/srsEngine.test.js`
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextReview, evaluateSessionAction } from './srsEngine.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a Date pinned to a known ISO date string. */
const fixedDate = (iso) => new Date(iso);

/** Strip sub-second precision for stable comparisons. */
const dateOnly = (iso) => iso.split('.')[0] + 'Z';

// ── Phase 2 — SM-2 Interval Calculations ────────────────────────────

describe('calculateNextReview — SM-2 Large Cycle', () => {
  const TODAY = '2026-07-09T12:00:00.000Z';

  it('Forgotten: sets interval to 1, eases by −0.2 (floor 1.3)', () => {
    const result = calculateNextReview(5, 2.5, 'Forgotten', fixedDate(TODAY));

    assert.equal(result.intervalDays, 1);
    assert.equal(result.easeFactor, 2.3);
    assert.ok(result.nextReview.startsWith('2026-07-10'));
  });

  it('Forgotten: ease floor at 1.3 is enforced', () => {
    const result = calculateNextReview(5, 1.4, 'Forgotten', fixedDate(TODAY));

    assert.equal(result.easeFactor, 1.3);
  });

  it('Unfamiliar: interval increased by 20 %, ease unchanged', () => {
    const result = calculateNextReview(10, 2.5, 'Unfamiliar', fixedDate(TODAY));

    // 10 * 1.2 = 12
    assert.equal(result.intervalDays, 12);
    assert.equal(result.easeFactor, 2.5);
    assert.ok(result.nextReview.startsWith('2026-07-21'));
  });

  it('Unfamiliar: interval min 1 when interval is 0', () => {
    const result = calculateNextReview(0, 2.5, 'Unfamiliar', fixedDate(TODAY));

    // 0 * 1.2 = 0, clamped to 1
    assert.equal(result.intervalDays, 1);
    assert.equal(result.easeFactor, 2.5);
  });

  it('Familiar: interval multiplied by ease, ease unchanged', () => {
    const result = calculateNextReview(10, 2.5, 'Familiar', fixedDate(TODAY));

    // 10 * 2.5 = 25
    assert.equal(result.intervalDays, 25);
    assert.equal(result.easeFactor, 2.5);
    assert.ok(result.nextReview.startsWith('2026-08-03'));
  });

  it('Familiar: interval min 1 when interval is 0', () => {
    const result = calculateNextReview(0, 2.5, 'Familiar', fixedDate(TODAY));

    // 0 * 2.5 = 0, clamped to 1
    assert.equal(result.intervalDays, 1);
    assert.equal(result.easeFactor, 2.5);
  });

  it('rounds fractional intervals to whole days', () => {
    const result = calculateNextReview(3, 2.5, 'Familiar', fixedDate(TODAY));

    // 3 * 2.5 = 7.5 → rounded to 8
    assert.equal(result.intervalDays, 8);
  });

  it('returns nextReview as an ISO 8601 string', () => {
    const result = calculateNextReview(1, 2.5, 'Familiar', fixedDate(TODAY));

    assert.equal(typeof result.nextReview, 'string');
    assert.ok(result.nextReview.endsWith('Z') || result.nextReview.includes('T'));
  });

  it('throws on unknown feedback value', () => {
    assert.throws(
      () => calculateNextReview(1, 2.5, 'Unknown'),
      /Invalid feedback/,
    );
  });
});

// ── Phase 2 — Minimum Ease Floor (dedicated test) ───────────────────

describe('Minimum Ease Floor (TEST.md Phase 2)', () => {
  const TODAY = '2026-07-09T12:00:00.000Z';

  it('ease 1.4 → Forgotten → ease 1.3 (not below floor)', () => {
    const result = calculateNextReview(5, 1.4, 'Forgotten', fixedDate(TODAY));

    assert.equal(result.intervalDays, 1);
    assert.equal(result.easeFactor, 1.3); // 1.4 − 0.2 = 1.2 → clamped to 1.3
  });

  it('ease 1.3 → Forgotten → stays 1.3', () => {
    const result = calculateNextReview(5, 1.3, 'Forgotten', fixedDate(TODAY));

    assert.equal(result.easeFactor, 1.3);
  });

  it('ease 5.0 → Forgotten → ease 4.8 (no clamp needed)', () => {
    const result = calculateNextReview(5, 5.0, 'Forgotten', fixedDate(TODAY));

    assert.equal(result.easeFactor, 4.8);
  });
});

// ── Phase 2 — Session Queue Evaluation ──────────────────────────────

describe('evaluateSessionAction — Session Queue (Small Cycle)', () => {
  it('Forgotten → requeue: true', () => {
    assert.deepEqual(evaluateSessionAction('Forgotten'), { requeue: true });
  });

  it('Unfamiliar → requeue: true', () => {
    assert.deepEqual(evaluateSessionAction('Unfamiliar'), { requeue: true });
  });

  it('Familiar → requeue: false', () => {
    assert.deepEqual(evaluateSessionAction('Familiar'), { requeue: false });
  });

  it('throws on invalid feedback string', () => {
    assert.throws(() => evaluateSessionAction('Maybe'), /Invalid feedback/);
  });

  it('throws on null', () => {
    assert.throws(() => evaluateSessionAction(null), /Invalid feedback/);
  });

  it('throws on undefined', () => {
    assert.throws(() => evaluateSessionAction(undefined), /Invalid feedback/);
  });
});

// ── Phase 2 — Session Queue Boundary (empty / null queue) ──────────

describe('Session Queue Boundary (TEST.md Phase 2)', () => {
  it('evaluateSessionAction throws on empty string', () => {
    assert.throws(() => evaluateSessionAction(''), /Invalid feedback/);
  });

  it('evaluateSessionAction throws on number', () => {
    assert.throws(() => evaluateSessionAction(0), /Invalid feedback/);
  });
});

// ── Phase 2 — Query Constraints (structural note) ──────────────────

describe('Query Constraints (mobile fetch limit)', () => {
  it('srsEngine exports expected symbols for consumer code', () => {
    // The mobile sync layer (lib/supabase.js, task 2.3) is responsible
    // for appending `.limit(deck.daily_review_limit)` to the Supabase query.
    // This test confirms the engine's public API is stable for that consumer.
    assert.equal(typeof calculateNextReview, 'function');
    assert.equal(typeof evaluateSessionAction, 'function');
  });
});

// ── Smoke: run from web workspace root ─────────────────────────────

import { run } from 'node:test';
import { tap } from 'node:test/reporters';

if (process.argv[1] === import.meta.filename) {
  run({ files: [import.meta.filename] }).compose(tap).pipe(process.stdout);
}
