import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Button, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { normalizeUsername, signInWithUsername } from '@/lib/usernameAuth';

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setReady(true); if (error) setMessage(error.message); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  async function authenticate(signUp: boolean) {
    setBusy(true); setMessage('');
    try {
      const chosen = normalizeUsername(username);
      if (signUp && chosen.startsWith('user_')) throw new Error('The user_ prefix is reserved. Choose another username.');
      if (signUp && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
      const result = signUp ? await supabase.auth.signUp({ email: email.trim(), password,
        options: { data: { username: chosen } } }) : await signInWithUsername(supabase, chosen, password);
      if (result.error) throw result.error;
      if (signUp && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  if (!ready) return <ActivityIndicator />;
  if (session) return <View key={session.user.id} style={{ flex: 1, paddingTop: 40 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 }}>
      <Text>{session.user.email}</Text>
      <Button title="Sign out" onPress={async () => { const { error } = await supabase.auth.signOut(); if (error) setMessage(error.message); }} />
    </View>
    {!!message && <Text>{message}</Text>}
    {children}
  </View>;
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 28 }}>FocusCards</Text>
    <Text>{registering ? 'Create account' : 'Sign in'}</Text>
    <TextInput accessibilityLabel="Username" placeholder="Username" autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={32} value={username} onChangeText={setUsername} style={{ borderWidth: 1, padding: 12 }} />
    {registering && <>
      <Text>3–32 letters, digits or underscores. Usernames ignore capitalization.</Text>
      <TextInput accessibilityLabel="Email" placeholder="Email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} style={{ borderWidth: 1, padding: 12 }} />
    </>}
    <TextInput accessibilityLabel="Password" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={{ borderWidth: 1, padding: 12 }} />
    <Button title={registering ? 'Create account' : 'Sign in'} disabled={busy || !username || !password || (registering && (!email || password.length < 6))} onPress={() => authenticate(registering)} />
    <Button title={registering ? 'Already have an account? Sign in' : 'Create a new account'} disabled={busy} onPress={() => { setRegistering(!registering); setPassword(''); setMessage(''); }} />
    <Text accessibilityLiveRegion="polite">{message}</Text>
  </View>;
}
