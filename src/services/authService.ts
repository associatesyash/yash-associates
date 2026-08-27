import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Cloud configuration is missing');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<boolean> {
  if (!supabase) throw new Error('Cloud configuration is missing');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return Boolean(data.session);
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud configuration is missing');
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => undefined } } };
  return supabase.auth.onAuthStateChange(callback);
}
