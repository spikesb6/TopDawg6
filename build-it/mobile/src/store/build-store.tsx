import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { mergeState, freshState, type BuildState } from '@/lib/state';
import { mergeBuilds } from '@/lib/sync';

// The build is kept on this phone. When signed in, the account store copies it to the cloud.
const STORAGE_KEY = 'build-it/state';
const SYNC_KEY = 'build-it/sync';

/** dirty: changed since the last sync. version: the account version this phone last saw. */
export type SyncMeta = { dirty: boolean; version: number | null };

type Snapshot = { state: BuildState; meta: SyncMeta; revision: number };

type BuildStore = {
  state: BuildState;
  meta: SyncMeta;
  loaded: boolean;
  /** Applies a change on this phone and saves it. */
  update: (change: (prev: BuildState) => BuildState) => void;
  replace: (next: BuildState) => void;
  /** For the sync engine: the latest values, without waiting for a render. */
  snapshot: () => Snapshot;
  /** Takes the account's copy as-is. */
  applyRemote: (state: BuildState, version: number) => void;
  /** Records a finished save. Changes made while it was saving are kept and stay unsynced. */
  finishPush: (pushed: BuildState, version: number, revisionAtStart: number) => void;
  /** Forgets the account link (after sign-out). The build stays on the phone. */
  detach: () => void;
};

const Ctx = createContext<BuildStore | null>(null);

export function BuildStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BuildState>(freshState);
  const [meta, setMeta] = useState<SyncMeta>({ dirty: false, version: null });
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<Snapshot>({ state, meta, revision: 0 });

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(SYNC_KEY)])
      .then(([raw, rawMeta]) => {
        if (raw) set(mergeState(JSON.parse(raw) as Partial<BuildState>), undefined, false);
        if (rawMeta) set(undefined, JSON.parse(rawMeta) as SyncMeta, false);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function set(nextState?: BuildState, nextMeta?: SyncMeta, persist = true) {
    if (nextState) {
      ref.current.state = nextState;
      setState(nextState);
      if (persist) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)).catch(() => {});
    }
    if (nextMeta) {
      ref.current.meta = nextMeta;
      setMeta(nextMeta);
      if (persist) AsyncStorage.setItem(SYNC_KEY, JSON.stringify(nextMeta)).catch(() => {});
    }
  }

  const update: BuildStore['update'] = (change) => {
    ref.current.revision++;
    set(change(ref.current.state), { ...ref.current.meta, dirty: true });
  };

  const store: BuildStore = {
    state,
    meta,
    loaded,
    update,
    replace: (next) => update(() => next),
    snapshot: () => ({ ...ref.current }),
    applyRemote: (next, version) => set(next, { dirty: false, version }),
    finishPush: (pushed, version, revisionAtStart) => {
      if (ref.current.revision === revisionAtStart) set(pushed, { dirty: false, version });
      else set(mergeBuilds(ref.current.state, pushed), { dirty: true, version });
    },
    detach: () => set(undefined, { dirty: false, version: null }),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useBuild() {
  const store = useContext(Ctx);
  if (!store) throw new Error('useBuild must be used inside BuildStoreProvider');
  return store;
}
