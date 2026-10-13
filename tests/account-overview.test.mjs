import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fetchAccountOverview, registeredDays, tomorrowEnd } from '../focuscards-web/src/lib/accountOverview.js';

test('account calendar metrics use local days, including DST and day-one registration', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/London';
  try {
    assert.equal(tomorrowEnd(new Date('2026-03-28T12:00:00Z')), '2026-03-29T23:00:00.000Z');
    assert.equal(tomorrowEnd(new Date('2026-10-24T12:00:00Z')), '2026-10-26T00:00:00.000Z');
    assert.equal(registeredDays('2026-03-28T23:30:00Z', new Date('2026-03-30T00:15:00+01:00')), 3);
    assert.equal(registeredDays('2026-10-13T07:00:00Z', new Date('2026-10-13T08:00:00Z')), 1);
    assert.equal(registeredDays(undefined), null);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('account client reports real totals, an unbroken streak, and missing migration errors', async () => {
  const now = new Date(2026, 9, 13, 12);
  let args;
  const client = { rpc: async (name, input) => {
    assert.equal(name, 'get_account_overview'); args = input;
    return { data: { username: 'alice', decks: [
      { card_count: '1205', due_count: '1100', tomorrow_due_count: '1200' },
      { card_count: 0, due_count: 0, tomorrow_due_count: 0 },
    ], check_in_dates: ['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-09'].map((check_in_date) => ({ check_in_date })) } };
  } };
  const overview = await fetchAccountOverview(client, now);
  assert.equal(overview.cardCount, 1205);
  assert.equal(overview.tomorrowDueCount, 1200);
  assert.equal(overview.streak, 3);
  assert.equal(overview.checkedInToday, true);
  assert.equal(args.p_tomorrow_end, new Date(2026, 9, 15).toISOString());
  client.rpc = async () => ({ data: { decks: [], check_in_dates: [{ check_in_date: '2026-10-12' }] } });
  assert.equal((await fetchAccountOverview(client, now)).streak, 1);
  assert.equal((await fetchAccountOverview(client, now)).checkedInToday, false);
  client.rpc = async () => ({ error: { code: 'PGRST202' } });
  await assert.rejects(fetchAccountOverview(client, now), /202610130001_account_overview.sql/);
  client.rpc = async () => ({ error: { message: 'Network unavailable' } });
  await assert.rejects(fetchAccountOverview(client, now), /Network unavailable/);
  client.rpc = async () => ({ data: null });
  await assert.rejects(fetchAccountOverview(client, now), /返回异常/);
});

test('account RPC preserves ownership and aggregates all cards with an exclusive tomorrow cutoff', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const alice = '10000000-0000-0000-0000-000000000001';
  const bob = '20000000-0000-0000-0000-000000000002';
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${alice}', '{}'), ('${bob}', '{}');`);
  for (const name of ['202610080001_user_isolation_and_reviews', '202610100002_username_login', '202610130001_account_overview']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  // Re-applying the overview migration is safe.
  await db.exec(await readFile(new URL('../supabase/migrations/202610130001_account_overview.sql', import.meta.url), 'utf8'));
  await db.exec(`update public.account_usernames set username = 'alice' where user_id = '${alice}';
    update public.account_usernames set username = 'bob' where user_id = '${bob}';`);
  const asUser = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('set role authenticated');
  };
  const createDeck = async (name) => (await db.query(
    'insert into public.decks(name, daily_review_limit) values ($1, 1) returning id', [name]
  )).rows[0].id;
  await asUser(alice);
  const aliceDeck = await createDeck('Algorithms');
  await createDeck('Empty deck');
  await db.query("insert into public.cards(deck_id, front, back, next_review) select $1, 'Q', 'A', now() - interval '1 day' from generate_series(1, 1201)", [aliceDeck]);
  // Start from a server-relative boundary to keep this regression date independent.
  const end = (await db.query("select (date_trunc('day', now()) + interval '2 days')::text as cutoff")).rows[0].cutoff;
  for (const offset of ["- interval '1 second'", '', "+ interval '1 second'"]) {
    await db.query(`insert into public.cards(deck_id, front, back, next_review) values ($1, 'Q', 'A', $2::timestamptz ${offset})`, [aliceDeck, end]);
  }
  await db.exec("insert into public.check_ins(check_in_date) values ('2026-10-12'), ('2026-10-13')");
  const get = async () => (await db.query('select public.get_account_overview($1) as overview', [end])).rows[0].overview;
  const overview = await get();
  assert.equal(overview.username, 'alice');
  assert.equal(overview.decks.length, 2);
  const deck = overview.decks.find((row) => row.id === aliceDeck);
  assert.equal(deck.card_count, 1204);
  assert.equal(deck.due_count, 1201);
  assert.equal(deck.tomorrow_due_count, 1202); // Overdue + tomorrow, excluding next midnight.
  assert.equal(overview.decks.find((row) => row.name === 'Empty deck').card_count, 0);
  assert.equal(overview.check_in_dates.length, 2);
  await asUser(bob);
  const empty = await get();
  assert.equal(empty.username, 'bob');
  assert.deepEqual(empty.decks, []);
  assert.deepEqual(empty.check_in_dates, []);
  await createDeck('Private Bob deck');
  assert.equal((await get()).decks.length, 1);
  await asUser(alice);
  assert.equal((await get()).decks.length, 2);
  await asUser('');
  await assert.rejects(get(), /Sign in/);
  await db.exec('reset role; set role anon');
  await assert.rejects(get(), /permission denied/i);
});
