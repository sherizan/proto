import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { formatAppleFullName } from './apple-auth';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.warn('Could not restore the sign-in session.', error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    // Supabase recommends refreshing the session only while the app is foregrounded.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();

    return () => {
      authSub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  async function signInWithApple() {
    // Bind the Apple identity token to a one-time nonce so it can't be replayed.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('No identityToken.');

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;

    // Apple sends the name only on first sign-in — persist it if present.
    const fullName = formatAppleFullName(credential.fullName);
    if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
  }

  async function signOut() {
    // Sign-out clears the local session regardless; never let a network hiccup throw.
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('Sign-out reported an error.', error.message);
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
