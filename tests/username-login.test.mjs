import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { normalizeUsername, signInWithUsername } from '../focuscards-web/src/lib/usernameAuth.js';

test('username migration preserves accounts, reserves names and enforces isolation', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated;
    create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
    insert into auth.users values ('00000000-0000-0000-0000-000000000001', 'old@example.com', '{}');`);
  const sql = await readFile(new URL('../supabase/migrations/202610100002_username_login.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  assert.equal((await db.query('select count(*)::int as count from public.account_usernames')).rows[0].count, 1);
  await db.exec(`insert into auth.users values
    ('00000000-0000-0000-0000-000000000002', 'alice@example.com', '{"username":"Alice"}');`);
  assert.equal((await db.query("select username from public.account_usernames where username = 'alice'")).rows.length, 1);
  await assert.rejects(db.exec(`insert into auth.users values
    ('00000000-0000-0000-0000-000000000003', 'duplicate@example.com', '{"username":"ALICE"}');`), /unique/i);
  assert.equal((await db.query("select id from auth.users where email = 'duplicate@example.com'")).rows.length, 0);
  await assert.rejects(db.exec(`insert into auth.users values
    ('00000000-0000-0000-0000-000000000003', 'invalid@example.com', '{"username":"user_test"}');`), /reserved/i);
  await db.exec(`update auth.users set raw_user_meta_data = '{"username":"hacked"}' where email = 'alice@example.com';`);
  assert.equal((await db.query("select username from public.account_usernames where username='alice'")).rows.length, 1);
  await db.exec('set role anon');
  await assert.rejects(db.exec('select * from public.account_usernames'), /permission/i);
  await assert.rejects(db.exec("select public.consume_username_login_attempt('alice')"), /permission/i);
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", ['00000000-0000-0000-0000-000000000002']);
  await db.exec('set role authenticated');
  assert.deepEqual((await db.query('select username from public.account_usernames')).rows, [{ username: 'alice' }]);
  await assert.rejects(db.exec("update public.account_usernames set username='other'"), /permission/i);
  await db.exec('reset role; set role service_role');
  for (let i = 0; i < 10; i++) assert.equal((await db.query("select public.consume_username_login_attempt('alice') as ok")).rows[0].ok, true);
  assert.equal((await db.query("select public.consume_username_login_attempt('alice') as ok")).rows[0].ok, false);
  await db.exec("reset role; update public.username_login_attempts set window_start=now()-interval '6 minutes'; set role service_role");
  assert.equal((await db.query("select public.consume_username_login_attempt('alice') as ok")).rows[0].ok, true);
});

test('client normalizes names and stores only a successfully returned session', async () => {
  assert.equal(normalizeUsername(' Alice '), 'alice');
  assert.throws(() => normalizeUsername('a@b.com'));
  let body;
  let session;
  const client = {
    functions: { invoke: async (_name, input) => { body = input.body; return { data: { access_token: 'access', refresh_token: 'refresh' } }; } },
    auth: { setSession: async (value) => { session = value; return { data: {} }; } },
  };
  await signInWithUsername(client, 'ALICE', 'password');
  assert.deepEqual(body, { username: 'alice', password: 'password' });
  assert.deepEqual(session, { access_token: 'access', refresh_token: 'refresh' });
  client.functions.invoke = async () => ({ data: {} });
  session = null;
  await assert.rejects(signInWithUsername(client, 'alice', 'wrong'), /invalid session/);
  assert.equal(session, null);
});

test('Edge login returns no account details for unknown usernames or wrong passwords', async () => {
  const require = createRequire(new URL('../focuscards-mobile/package.json', import.meta.url));
  const ts = require('typescript');
  const source = await readFile(new URL('../supabase/functions/username-login/index.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source.replace(/^import .*;\n/, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let handler;
  let profile = { user_id: 'alice-id' };
  let allowed = true;
  const admin = {
    rpc: async () => ({ data: allowed }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'private@example.com' } } }) } },
  };
  const auth = { auth: { signInWithPassword: async ({ password }) => password === 'correct' ?
    { data: { session: { access_token: 'a', refresh_token: 'r' } } } : { error: new Error('wrong'), data: {} } } };
  new Function('Deno', 'createClient', code)(
    { env: { get: (key) => key }, serve: (fn) => { handler = fn; } },
    (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : auth,
  );
  const invoke = (password) => handler(new Request('https://example.com/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'alice', password }),
  }));
  const wrong = await invoke('wrong');
  assert.equal(wrong.status, 401);
  const wrongBody = await wrong.json();
  profile = null;
  assert.deepEqual(await (await invoke('wrong')).json(), wrongBody);
  assert.doesNotMatch(JSON.stringify(wrongBody), /private@example|alice-id/);
  profile = { user_id: 'alice-id' };
  assert.deepEqual(await (await invoke('correct')).json(), { access_token: 'a', refresh_token: 'r' });
  allowed = false;
  assert.equal((await invoke('correct')).status, 429);
});
