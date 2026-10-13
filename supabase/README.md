# Database rollout

## Web AI assistant (bring your own API key)

Deploy the new authenticated Edge Function from the linked project root:

```sh
npx supabase functions deploy ai-answer
```

If this checkout is not linked, pass `--project-ref YOUR_PROJECT_REF` or link
the intended Supabase project first. `supabase/config.toml` disables gateway
JWT verification for this function because it supports current signing keys;
the handler itself requires a Bearer token and validates it with
`auth.getUser` **before** reading a supplied API key or contacting a provider.
Do not replace this with an anonymous or service-role-only handler.
The standard Edge Function `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment
variables are sufficient. No AI keys or new database migration are required
on the server. Never log request bodies or add API keys to VITE_* variables.

Open the avatar > AI 助手 in the web profile, select a service, enter its API
key and model, and save. Settings and all provider keys live only in the
authenticated React App's memory; refreshing, closing the page, signing out
or changing accounts requires entering the keys again. Keys are not saved in
Supabase, localStorage or sessionStorage. Each generation forwards the chosen
key and the front-side question through this Edge Function to the matching
official provider endpoint. Calls are billed to that user's provider account.

With a deck selected, write a question on the front and check AI回答 above the
back editor to generate once. When checked before writing the question, fill
the question and click 生成回答. Subsequent front edits require an explicit
regeneration rather than a paid request on every keystroke. Replacing an
existing answer requires confirmation. Answers remain editable and unsaved
until the normal card-save action. Code-mode front examples are converted to
fenced Markdown before sending; hidden editor metadata is not sent.

Cancellation, draft edits and navigation invalidate in-flight responses;
late results cannot overwrite another card or manual edits. Generation is
single-flight, has a 60-second upstream timeout, and reports authentication,
quota, model, network and incomplete-answer errors without clearing the draft.
Cancelling cannot guarantee a provider stops processing or waives its charge.
Only the three fixed official API hosts are allowed; custom URLs are not accepted.
Provider error bodies and reasoning text are never shown in the editor.

Adapters follow the official [OpenAI Responses text-generation docs](https://developers.openai.com/api/docs/guides/text),
[Gemini generateContent reference](https://ai.google.dev/api/generate-content),
and [DeepSeek Chat Completions example](https://api-docs.deepseek.com/api_samples/chat_curl/).
Default models are `gpt-4.1-mini`, `gemini-3.8-flash`, and `deepseek-flash`;
users can edit model IDs according to their account access. OpenAI requests
set `store: false`. This disables stored response retrieval, not every form
of provider retention; the provider's own data policies still apply.
Tests mock provider responses and do not spend real API credits.

## Web account overview

Apply `migrations/202610130001_account_overview.sql` after the ownership and
username migrations to enable the web account page. Click the top-left avatar
in the editor to open it. Deck names open their card list; right-click a deck
or use its ⋯ button to browse cards, add a card, or review that deck.

The read-only `get_account_overview` RPC aggregates all owned decks and cards
in PostgreSQL, including libraries larger than the API's row limit. It uses
the caller's authentication and existing RLS; it does not expose other accounts.
Tomorrow's count includes all cards due before the end of the next local
calendar day, including overdue cards, without applying daily review limits.
It reflects the current schedule and changes after reviews. Registration days
use local calendar dates and count the registration date as day 1. Check-in
streaks use the same local-date rules as the mobile app.

The page refreshes on entry, on database changes, when returning to the tab,
every minute while visible, and through the refresh button. No migration is
run automatically; a missing RPC produces an actionable error on the page.

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
