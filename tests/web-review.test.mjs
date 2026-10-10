import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewApi } from '../focuscards-web/src/lib/review.js';
import { commitSessionAction } from '../focuscards-web/src/utils/reviewSession.js';

function fixture(reviewed = 3) {
  const calls = [];
  let fail = false;
  const client = {
    from(table) {
      const query = { then(resolve) { return Promise.resolve({ data: table === 'cards' ? [{ id: 'card' }] : { id: 'deck', daily_review_limit: 10 } }).then(resolve); } };
      for (const method of ['select', 'eq', 'single', 'update', 'lte', 'order', 'limit', 'upsert']) {
        query[method] = (...args) => { calls.push([table, method, ...args]); return query; };
      }
      return query;
    },
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === 'get_daily_review_count') return { data: reviewed };
      if (name === 'get_due_counts') return { data: [{ deck_id: 'deck', due_count: '1500' }] };
      return fail ? { error: { message: 'Daily review limit reached' } } : { data: {} };
    },
  };
  return { api: createReviewApi(client), calls, setFail(value) { fail = value; } };
}

test('web setup uses aggregate due counts and start subtracts already-reviewed quota', async () => {
  const { api, calls } = fixture();
  assert.equal((await api.summary('deck')).due, 1500);
  assert.deepEqual(await api.start('deck', 10), [{ id: 'card' }]);
  assert.ok(calls.some(([table, method, value]) => table === 'cards' && method === 'limit' && value === 7));
  const exhausted = fixture(10);
  assert.deepEqual(await exhausted.api.start('deck', 10), []);
  assert.equal(exhausted.calls.some(([table]) => table === 'cards'), false);
});

test('failed web ratings do not advance; repeats avoid extra persistence', async () => {
  const { api, calls, setFail } = fixture();
  const written = new Set();
  const card = { id: 'card', interval_days: 2, ease_factor: 2.5 };
  setFail(true);
  await assert.rejects(commitSessionAction(card, 'Forgotten', written, api.persist), /Daily review limit/);
  assert.equal(written.size, 0);
  setFail(false);
  assert.deepEqual(await commitSessionAction(card, 'Forgotten', written, api.persist), { requeue: true });
  assert.deepEqual(await commitSessionAction(card, 'Familiar', written, api.persist), { requeue: false });
  assert.equal(calls.filter(([name]) => name === 'record_review').length, 2);
  await api.checkIn('2026-10-10');
  assert.ok(calls.some(([table, method, , options]) => table === 'check_ins' && method === 'upsert' && options.onConflict === 'user_id,check_in_date'));
});
