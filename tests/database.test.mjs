import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration, ownership and daily review transactions', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const alice = '00000000-0000-0000-0000-000000000001';
  const bob = '00000000-0000-0000-0000-000000000002';
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');
    create table public.check_ins(id uuid primary key default gen_random_uuid(),
      check_in_date date unique not null, created_at timestamptz default now());
    insert into public.check_ins(check_in_date) values ('2026-10-01');
  `);
  const migration = await readFile(new URL('../supabase/migrations/202610080001_user_isolation_and_reviews.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec('create policy old_public_access on public.decks for all using (true) with check (true)');
  await db.exec(migration); // Repeatability matters for existing installations.
  // Older deployments may be missing the two RPCs added late in the migration.
  await db.exec('drop function public.get_due_counts(); drop function public.get_daily_review_count(uuid)');
  const repair = await readFile(new URL('../supabase/migrations/202610100001_refresh_review_rpcs.sql', import.meta.url), 'utf8');
  await db.exec(repair);
  await db.exec(repair);
  const asUser = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('set role authenticated');
  };
  const createDeck = async (name, limit = 1) => (await db.query(
    'insert into public.decks(name, daily_review_limit) values ($1, $2) returning id', [name, limit]
  )).rows[0].id;
  const createCard = async (deck) => (await db.query(
    "insert into public.cards(deck_id, front, back) values ($1, 'Question', 'Answer') returning id", [deck]
  )).rows[0].id;
  await asUser(alice);
  const aliceDeck = await createDeck('Alice');
  const first = await createCard(aliceDeck);
  const second = await createCard(aliceDeck);
  await asUser(bob);
  const bobDeck = await createDeck('Bob', 5);
  const bobCard = await createCard(bobDeck);

  await t.test('users cannot read, edit, create cards in, or transfer another user’s deck', async () => {
    const decks = await db.query('select name from public.decks');
    assert.deepEqual(decks.rows, [{ name: 'Bob' }]);
    assert.equal((await db.query('select id from public.cards')).rows.length, 1);
    assert.equal((await db.query("update public.cards set front = 'Hacked' where id = $1 returning id", [first])).rows.length, 0);
    await assert.rejects(createCard(aliceDeck), /row-level security/i);
    await assert.rejects(db.query('update public.decks set user_id = $1 where id = $2', [alice, bobDeck]), /row-level security/i);
  });
  await t.test('review RPC rejects another user’s card', async () => {
    await assert.rejects(db.query("select public.record_review($1, 1, 2.5, now() + interval '1 day')", [first]), /Card not found/);
  });
  await asUser(alice);
  await t.test('invalid reviews neither consume quota nor alter SRS', async () => {
    await assert.rejects(db.query("select public.record_review($1, 0, 2.5, now() + interval '1 day')", [first]), /Invalid review state/);
    assert.equal((await db.query('select * from public.review_events')).rows.length, 0);
  });
  await t.test('first review is atomic, repeats are idempotent, and further cards hit quota', async () => {
    await db.query("select public.record_review($1, 1, 2.3, now() + interval '1 day')", [first]);
    await db.query("select public.record_review($1, 20, 2.5, now() + interval '20 days')", [first]);
    const card = (await db.query('select interval_days, ease_factor from public.cards where id = $1', [first])).rows[0];
    assert.deepEqual(card, { interval_days: 1, ease_factor: 2.3 });
    assert.equal((await db.query('select * from public.review_events')).rows.length, 1);
    await assert.rejects(db.query("select public.record_review($1, 1, 2.5, now() + interval '1 day')", [second]), /Daily review limit/);
    assert.equal((await db.query('select interval_days from public.cards where id = $1', [second])).rows[0].interval_days, 0);
    await assert.rejects(db.query('delete from public.review_events'), /permission denied/i);
  });
  await t.test('check-ins are idempotent per user and independent across users', async () => {
    const upsert = "insert into public.check_ins(check_in_date) values ('2026-10-08') on conflict(user_id, check_in_date) do update set check_in_date = excluded.check_in_date";
    await db.exec(upsert);
    await db.exec(upsert);
    assert.equal((await db.query('select * from public.check_ins')).rows.length, 1);
    await asUser(bob);
    await db.exec(upsert);
    assert.equal((await db.query('select * from public.check_ins')).rows.length, 1);
    assert.equal((await db.query('select * from public.review_events')).rows.length, 0);
    await db.query("select public.record_review($1, 1, 2.5, now() + interval '1 day')", [bobCard]);
  });
  await t.test('dashboard counts exceed API row limits and daily counts are isolated', async () => {
    await db.query("insert into public.cards(deck_id, front, back) select $1, 'Q', 'A' from generate_series(1, 1201)", [bobDeck]);
    const counts = await db.query('select * from public.get_due_counts()');
    assert.deepEqual(counts.rows, [{ deck_id: bobDeck, due_count: 1201 }]);
    assert.equal((await db.query('select public.get_daily_review_count($1) as count', [bobDeck])).rows[0].count, 1);
    assert.equal((await db.query('select public.get_daily_review_count($1) as count', [aliceDeck])).rows[0].count, 0);
  });
  await t.test('legacy rows remain preserved, and anonymous access is denied', async () => {
    await db.exec('reset role');
    assert.equal((await db.query('select * from public.check_ins where user_id is null')).rows.length, 1);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.decks'), /permission denied/i);
    await assert.rejects(db.query("select public.record_review($1, 1, 2.5, now() + interval '1 day')", [first]), /permission denied/i);
  });
});
