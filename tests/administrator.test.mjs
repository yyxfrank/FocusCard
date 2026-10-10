import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('administrator assignment preserves data and is repeatable', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    -- Simulate the original production table, which has no created_at column.
    create table public.check_ins (
      id uuid primary key default gen_random_uuid(), check_in_date date not null
    );
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202610080001_user_isolation_and_reviews.sql', import.meta.url), 'utf8'));
  await db.exec(`
    insert into public.decks(name) values ('Legacy');
    insert into public.cards(deck_id, front, back) select id, 'Original question', 'Original answer' from public.decks;
    insert into public.check_ins(check_in_date) values ('2026-10-08'), ('2026-10-08');
  `);
  const assignment = await readFile(new URL('../supabase/assign_administrator.example.sql', import.meta.url), 'utf8');
  await assert.rejects(db.exec(assignment), /Create owner@example.com/);
  await db.exec('rollback');
  const id = '00000000-0000-0000-0000-000000000003';
  await db.query("insert into auth.users values ($1, 'owner@example.com', '{\"provider\":\"email\"}')", [id]);
  await db.exec(assignment);
  await db.exec(assignment);
  assert.equal((await db.query('select user_id from public.decks')).rows[0].user_id, id);
  assert.deepEqual((await db.query('select front, back from public.cards')).rows,
    [{ front: 'Original question', back: 'Original answer' }]);
  assert.equal((await db.query('select * from public.check_ins where user_id is not null')).rows.length, 1);
  assert.equal((await db.query('select * from public.check_ins where user_id is null')).rows.length, 1);
  assert.deepEqual((await db.query('select raw_app_meta_data from auth.users')).rows[0].raw_app_meta_data,
    { provider: 'email', role: 'administrator' });
});
