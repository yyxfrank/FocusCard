# Username login rollout

Apply `migrations/202610100002_username_login.sql` in Supabase SQL Editor after
the existing migrations. Do this before deploying the new clients: new signups
must supply username metadata. Usernames are case insensitive, 3–32 ASCII letters,
digits or underscores; the `user_` prefix is reserved for migrated accounts.

Deploy the login Edge Function from the repository root:

```powershell
npx.cmd supabase login
npx.cmd supabase functions deploy username-login --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The hosted function uses the standard SUPABASE_URL, SUPABASE_ANON_KEY and
SUPABASE_SERVICE_ROLE_KEY server environment variables. Never put the service
role key in either client. The endpoint is callable without a session because
it performs password authentication itself. It never returns a username-to-email
lookup to unauthenticated clients. Password verification uses Supabase Auth;
passwords are not stored in application tables. Login is limited to ten attempts
per username per five-minute window in addition to Supabase's Auth limits.

In Authentication settings, keep Email/password and new user signup enabled,
but turn **Confirm Email** off. This is a dashboard setting; this migration does
not change it. Signup then immediately creates a session. An entered email is
stored but its ownership is not verified. If confirmation is still enabled,
the app instead asks the user to confirm by email.

Existing users receive temporary `user_…` names; IDs, passwords, decks and reviews
stay unchanged. Inspect them in SQL Editor (never expose this query via a public RPC):

```sql
select u.email, n.username
from auth.users u join public.account_usernames n on n.user_id = u.id;
```

To give the existing owner the requested administrator login name, replace the
placeholder email below locally and execute this separately:

```sql
update public.account_usernames
set username = 'administrator'
where user_id = (select id from auth.users where lower(email) = lower('OWNER_EMAIL'));
```

Username is a login name; it does not grant administrator privileges. Existing
administrator app metadata and user isolation continue to apply. Names cannot be
changed through user metadata or client table writes; operators can rename them
through SQL Editor. Duplicate names fail atomically during signup.

After deploying, test two accounts: registration without a confirmation email,
username/password login on both clients, wrong password rejection, duplicate-name
rejection, and isolation of their decks. Refresh the web deployment and reload or
rebuild the mobile app. The existing app does not implement email/password recovery.
