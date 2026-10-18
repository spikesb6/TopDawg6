import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { localPhotoUri, photoBytes } from '@/lib/photo-files';
import { markUploaded } from '@/lib/photos';
import * as remote from '@/lib/remote';
import { backendConfigured, supabase } from '@/lib/supabase';
import { planSync } from '@/lib/sync';
import { useBuild } from '@/store/build-store';

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';

type Account = {
  /** False when this copy of the app has no Supabase keys. Accounts are hidden then. */
  available: boolean;
  email: string | null;
  userId: string | null;
  status: SyncStatus;
  lastSynced: Date | null;
  error: string | null;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<Account | null>(null);

/** Saves at most this long after the last change. */
const PUSH_DELAY = 2000;

export function AccountProvider({ children }: { children: ReactNode }) {
  const build = useBuild();
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<'syncing' | 'synced' | 'error'>('syncing');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const buildRef = useRef(build);
  const userId = session?.user.id ?? null;
  const userRef = useRef<string | null>(null);
  const status: SyncStatus = !backendConfigured ? 'off' : !userId ? 'signed-out' : syncState;

  // Declared first so the sync effects below always see the latest values.
  useEffect(() => {
    buildRef.current = build;
    userRef.current = userId;
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  /** Returns true when photos were uploaded, so their new state needs one more save. */
  async function syncOnce(uid: string): Promise<boolean> {
    const b = buildRef.current;
    // A save can lose a race with another phone; then look again (a few times at most).
    for (let attempt = 0; attempt < 3; attempt++) {
      const snap = b.snapshot();
      const plan = planSync(snap.state, snap.meta.dirty, snap.meta.version, await remote.fetchBuild(uid));
      if (plan.action === 'none') break;
      if (plan.action === 'pull') {
        b.applyRemote(plan.data, plan.version);
        break;
      }
      const version =
        plan.action === 'create'
          ? await remote.createBuild(uid, plan.data)
          : await remote.pushBuild(uid, plan.data, plan.expectVersion);
      if (version != null) {
        b.finishPush(plan.data, version, snap.revision);
        break;
      }
    }
    // Then send photos that are only on this phone.
    const pending = b.snapshot().state.photos.filter((p) => !p.uploaded && localPhotoUri(p.id));
    const done: string[] = [];
    for (const p of pending) {
      await remote.uploadPhoto(uid, p.id, await photoBytes(p.id));
      done.push(p.id);
    }
    if (done.length) b.update((prev) => markUploaded(prev, done));
    return done.length > 0;
  }

  async function syncNow() {
    const uid = userRef.current;
    if (!uid) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setSyncState('syncing');
    try {
      do {
        again.current = false;
        if (await syncOnce(uid)) again.current = true;
      } while (again.current);
      setSyncState('synced');
      setError(null);
      setLastSynced(new Date());
    } catch (e) {
      setSyncState('error');
      setError(e instanceof Error ? e.message : 'Could not reach your account.');
    } finally {
      running.current = false;
    }
  }

  // Sync when someone signs in, and when the app comes back to the front.
  useEffect(() => {
    if (!backendConfigured || !userId) return;
    const t = build.loaded ? setTimeout(syncNow, 0) : undefined;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, build.loaded]);

  // Save changes shortly after they happen.
  useEffect(() => {
    if (!userId || !build.meta.dirty) return;
    const t = setTimeout(syncNow, PUSH_DELAY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, build.state, build.meta.dirty]);

  const account: Account = {
    available: backendConfigured,
    email: session?.user.email ?? null,
    userId,
    status,
    lastSynced,
    error,
    syncNow,
    signOut: async () => {
      await remote.signOut();
      build.detach();
    },
    deleteAccount: async () => {
      await remote.deleteAccount();
      build.detach();
    },
  };

  return <Ctx.Provider value={account}>{children}</Ctx.Provider>;
}

export function useAccount() {
  const account = useContext(Ctx);
  if (!account) throw new Error('useAccount must be used inside AccountProvider');
  return account;
}
