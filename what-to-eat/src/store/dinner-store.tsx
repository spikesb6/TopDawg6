import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { addPick, toggleFave, type Fave, type PastPick } from '@/lib/picker';

// Guest data lives on the device in the same shape as the favorites and picks tables.
const STORAGE_KEY = 'what-to-eat/v1';

type Saved = { favorites: Fave[]; picks: PastPick[] };

type DinnerStore = Saved & {
  loaded: boolean;
  isFave: (ideaId: number) => boolean;
  toggleFave: (ideaId: number) => void;
  lockIn: (ideaId: number) => void;
};

const StoreContext = createContext<DinnerStore | null>(null);

export function DinnerStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Saved>({ favorites: [], picks: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Saved>;
        setData({ favorites: saved.favorites ?? [], picks: saved.picks ?? [] });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = (next: (prev: Saved) => Saved) => {
    setData((prev) => {
      const value = next(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {});
      return value;
    });
  };

  const store: DinnerStore = {
    ...data,
    loaded,
    isFave: (ideaId) => data.favorites.some((f) => f.ideaId === ideaId),
    toggleFave: (ideaId) =>
      update((prev) => ({ ...prev, favorites: toggleFave(prev.favorites, ideaId, Date.now()) })),
    lockIn: (ideaId) =>
      update((prev) => ({ ...prev, picks: addPick(prev.picks, ideaId, Date.now()) })),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useDinnerStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useDinnerStore must be used inside DinnerStoreProvider');
  return store;
}
