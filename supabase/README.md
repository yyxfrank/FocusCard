# Database rollout

## Username login

The updated clients sign in with username/password and register with
username/email/password. Follow [USERNAME_LOGIN.md](USERNAME_LOGIN.md) to apply
the username migration, deploy its Edge Function, turn Confirm Email off, and
assign a readable username to existing accounts. The Email provider stays enabled.
Existing account passwords and card ownership are unchanged.

## Initial administrator

Choose the owner email locally. Create this account using
the app's Create account button and confirm its email, then run
a copy of `assign_administrator.example.sql` with `owner@example.com` replaced by the owner email in the Supabase SQL Editor after the main migration.
It marks the account as administrator and assigns all unassigned legacy decks
and one legacy check-in per date to it. Existing assigned decks and duplicate
legacy check-ins are preserved. The role is a trusted metadata label; current
RLS still restricts this account to its own decks. There is no cross-user admin
dashboard or automatic bypass of user isolation.

Alternatively, administrators with a service-role key can run
`node --env-file=.env.admin supabase/create_administrator.mjs` from the project
root. The ignored `.env.admin` needs `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAIL`; optionally set `SUPABASE_INVITE_REDIRECT_URL` to
an allowed password-setup page. This invites the account if it does not exist
and sets its role without changing existing passwords. Run the assignment SQL
afterward. The current app has no invitation password-setup page, so registering
through Create account is the simplest available path. Never share the key in
chat or place it in VITE_* / EXPO_PUBLIC_* variables.

## Migration

The clients now require Supabase email/password authentication and the migration
`migrations/202610080001_user_isolation_and_reviews.sql`. Apply that file in the
Supabase SQL editor before using the updated clients. Enable the Email provider
in Authentication; if confirmation is enabled, confirm the email before signing
in. Use the same account in both apps.

The migration enables RLS and replaces existing policies on decks, cards,
check_ins and review_events. Users can access only their decks, their decks'
cards, and their own check-ins/review history. Anonymous access is revoked.
Review history can only be written through record_review. The RPC checks
ownership, locks the deck, enforces the daily limit, and commits the SRS update
and history entry together. Each distinct card counts once per UTC day; the
intraday requeue does not consume another slot. Changing the configured limit
changes today's allowance too. Daily quotas reset at 00:00 UTC on every device.
Check-in streaks and local completion badges use the device's calendar date.

Existing rows are preserved with a null user_id and therefore hidden from
clients. An administrator must assign them deliberately after the owner creates
an account. Do not automatically assign shared data to the first person who
signs in. For a single previous owner, review the rows and run:

```sql
-- Replace OWNER-UUID with the intended auth.users.id. Run only after reviewing
-- all unassigned rows; this assigns every legacy deck to that single owner.
begin;
update public.decks set user_id = 'OWNER-UUID' where user_id is null;
update public.check_ins c set user_id = 'OWNER-UUID'
where c.id in (
  select distinct on (legacy.check_in_date) legacy.id
  from public.check_ins legacy
  where legacy.user_id is null and not exists (
    select 1 from public.check_ins owned
    where owned.user_id = 'OWNER-UUID' and owned.check_in_date = legacy.check_in_date
  )
  order by legacy.check_in_date, legacy.id
);
commit;
-- Duplicate legacy check-ins remain unassigned and preserved.
```

The migration adds decks/cards/check_ins to supabase_realtime when that
publication exists. Verify Realtime is enabled for those tables in Supabase.
The clients subscribe to changes and release subscriptions when unmounted.
Dashboard counts are aggregated in PostgreSQL by get_due_counts, so fetching
more than 200 or 1000 due cards does not truncate the badge counts.
Check-ins are upserted by user and date, allowing multiple completed decks in
one day without duplicate errors.

No migration is executed automatically by the app. The migration assumes UUID
deck/card IDs and the column names already used by the clients; inspect your
existing schema before applying it. Keep service_role keys out of both clients.
Local regression tests exercise the migration against a temporary PostgreSQL
engine with two simulated authenticated users; they do not validate your cloud
project or its Auth/Realtime configuration.

Run `npm install` at the repository root and in both client directories, then
`npm test` at the root for database, SRS, session-failure and math-parser tests.
Native math renders locally with KaTeX MathML inside WebView; it does not fetch
rendering scripts or fonts from a CDN. Test the final presentation on Android
and iOS devices after rebuilding the native app with the new dependencies.
