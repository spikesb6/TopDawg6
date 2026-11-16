// Calls to the Build It account: sign-in, the saved build, photo storage, account deletion.
import { photoStoragePath } from '@/lib/photos';
import type { BuildState } from '@/lib/state';
import { supabase } from '@/lib/supabase';
import type { Remote } from '@/lib/sync';

const BUCKET = 'photos';

function client() {
  if (!supabase) throw new Error('Accounts are not set up in this copy of the app.');
  return supabase;
}

/** Emails a 6-digit sign-in code. Creates the account the first time. */
export async function sendCode(email: string) {
  const { error } = await client().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  const { error } = await client().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signOut() {
  await client().auth.signOut();
}

export async function fetchBuild(userId: string): Promise<Remote> {
  const { data, error } = await client().from('builds').select('data, version').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { data: data.data as Partial<BuildState>, version: data.version as number } : null;
}

/** Saves the first copy. Returns null if another phone created it a moment earlier. */
export async function createBuild(userId: string, data: BuildState): Promise<number | null> {
  const { error } = await client().from('builds').insert({ user_id: userId, data, version: 1 });
  if (error?.code === '23505') return null;
  if (error) throw error;
  return 1;
}

/** Saves only if nobody saved since expectVersion. Returns the new version, or null if someone did. */
export async function pushBuild(userId: string, data: BuildState, expectVersion: number): Promise<number | null> {
  const next = expectVersion + 1;
  const { data: rows, error } = await client()
    .from('builds')
    .update({ data, version: next })
    .eq('user_id', userId)
    .eq('version', expectVersion)
    .select('version');
  if (error) throw error;
  return rows.length ? next : null;
}

export async function uploadPhoto(userId: string, id: string, bytes: Uint8Array) {
  const { error } = await client().storage.from(BUCKET).upload(photoStoragePath(userId, id), bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export async function deleteRemotePhoto(userId: string, id: string) {
  await client().storage.from(BUCKET).remove([photoStoragePath(userId, id)]);
}

export async function photoDownloadUrl(userId: string, id: string) {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(photoStoragePath(userId, id), 600);
  if (error) throw error;
  return data.signedUrl;
}

/** Deletes the signed-in person's account, saved build and photos (App Store rule). */
export async function deleteAccount() {
  const { error } = await client().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await client().auth.signOut();
}
