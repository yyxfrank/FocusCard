import { createRequire } from 'node:module';
const requireWeb = createRequire(new URL('../focuscards-web/package.json', import.meta.url));
const { createClient } = requireWeb('@supabase/supabase-js');

const email = process.env.ADMIN_EMAIL?.trim();
if (!email) throw new Error('Set ADMIN_EMAIL to the intended administrator email.');
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally. Never place the service-role key in a client env file.');
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Search all pages so rerunning does not create another account or reset a password.
let user;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  user = data.users.find((entry) => entry.email?.toLowerCase() === email);
  if (user || data.users.length < 100) break;
}
if (!user) {
  const username = (process.env.ADMIN_USERNAME ?? 'administrator').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username) || username.startsWith('user_')) {
    throw new Error('ADMIN_USERNAME must be 3-32 letters, digits or underscores and cannot start with user_.');
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: 'administrator', username },
    ...(process.env.SUPABASE_INVITE_REDIRECT_URL ? { redirectTo: process.env.SUPABASE_INVITE_REDIRECT_URL } : {}),
  });
  if (error) throw error;
  user = data.user;
  if (!user) throw new Error('Invitation did not return a user');
  console.log(`Invitation sent to ${email}. Set the password in Supabase or through your configured password-setup flow.`);
}
const { error } = await admin.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: 'administrator' },
  user_metadata: { ...user.user_metadata, display_name: 'administrator' },
});
if (error) throw error;
console.log(`Administrator account ready: ${email} (${user.id}).`);
console.log('Customize and run supabase/assign_administrator.example.sql in the Supabase SQL Editor to assign legacy decks and check-ins.');
