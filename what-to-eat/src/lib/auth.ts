import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function client() {
  if (!supabase) throw new Error('Supabase is not set up yet. Add the keys to .env.');
  return supabase;
}

/** Apple sign-in is offered on iPhone (native sheet) and on the web. */
export async function appleSignInAvailable() {
  if (Platform.OS === 'web') return true;
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Resolves true once signed in, false if the person backed out. */
async function signInWithOAuth(provider: 'google' | 'apple'): Promise<boolean> {
  const sb = client();
  if (Platform.OS === 'web') {
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return false; // the page navigates away to the provider
  }

  const redirectTo = makeRedirectUri({ path: 'auth-callback' });
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false; // closed or cancelled

  const params = new URL(result.url).searchParams;
  const failure = params.get('error_description') ?? params.get('error');
  if (failure) throw new Error(failure);
  const code = params.get('code');
  if (!code) throw new Error('Sign-in did not return a code.');
  const exchange = await sb.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
  return true;
}

export function signInWithGoogle() {
  return signInWithOAuth('google');
}

export async function signInWithApple(): Promise<boolean> {
  if (Platform.OS !== 'ios') return signInWithOAuth('apple');

  const sb = client();
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');

  const { data, error } = await sb.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple only shares the name on the very first sign-in, so save it right away.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ');
  if (name && data.user) {
    await sb.auth.updateUser({ data: { full_name: name } });
    await sb.from('profiles').update({ display_name: name }).eq('user_id', data.user.id);
  }
  return true;
}

export async function signOut() {
  await supabase?.auth.signOut();
}
