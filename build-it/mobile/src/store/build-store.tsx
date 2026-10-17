import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { mergeState, freshState, type BuildState } from '@/lib/state';

// The build is kept on this phone only. A backup code moves it to another phone or the web app.
const STORAGE_KEY = 'build-it/state';

type BuildStore = {
  state: BuildState;
  loaded: boolean;
  /** Applies a change and saves it. */
  update: (change: (prev: BuildState) => BuildState) => void;
  replace: (next: BuildState) => void;
};

const Ctx = createContext<BuildStore | null>(null);

export function BuildStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BuildState>(freshState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setState(mergeState(JSON.parse(raw) as Partial<BuildState>)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update: BuildStore['update'] = (change) =>
    setState((prev) => {
      const next = change(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  const store: BuildStore = { state, loaded, update, replace: (next) => update(() => next) };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useBuild() {
  const store = useContext(Ctx);
  if (!store) throw new Error('useBuild must be used inside BuildStoreProvider');
  return store;
}
