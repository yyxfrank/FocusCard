import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitSessionAction } from '../focuscards-mobile/src/utils/reviewSession.js';
const card = { id: 'card', interval_days: 5, ease_factor: 2.5 };
test('failed saves do not authorize queue advancement and remain retryable', async () => {
  const written = new Set();
  await assert.rejects(commitSessionAction(card, 'Familiar', written, async () => ({ error: 'Offline' })), /Offline/);
  assert.equal(written.size, 0);
  const action = await commitSessionAction(card, 'Familiar', written, async () => ({ error: null }));
  assert.deepEqual(action, { requeue: false });
  assert.equal(written.has(card.id), true);
});
test('only the first successful rating persists while subsequent ratings control the queue', async () => {
  const writes = [];
  const written = new Set();
  const persist = async (id, updates) => { writes.push({ id, updates }); return { error: null }; };
  assert.deepEqual(await commitSessionAction(card, 'Forgotten', written, persist), { requeue: true });
  assert.deepEqual(await commitSessionAction(card, 'Unfamiliar', written, persist), { requeue: true });
  assert.deepEqual(await commitSessionAction(card, 'Familiar', written, persist), { requeue: false });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].updates.interval_days, 1);
  assert.equal(writes[0].updates.ease_factor, 2.3);
});
test('unexpected persistence exceptions also leave the card retryable', async () => {
  const written = new Set();
  await assert.rejects(commitSessionAction(card, 'Familiar', written, async () => { throw new Error('Network'); }), /Network/);
  assert.equal(written.size, 0);
});
