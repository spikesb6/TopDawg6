import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { seedIdeas, type Idea } from '@/data/ideas';
import * as auth from '@/lib/auth';
import {
  addPick,
  addPlacePick,
  toggleFave,
  togglePlaceFave,
  type Fave,
  type PastPick,
  type PlaceFave,
} from '@/lib/picker';
import type { PlaceRef } from '@/lib/places';
import * as remote from '@/lib/remote';
import { backendConfigured, supabase } from '@/lib/supabase';
import { mergeFaves, mergePicks, mergePlaceFaves } from '@/lib/sync';

// Guest data lives on the device in the same shape as the favorites and picks tables.
// After sign-in it is copied to Supabase and cleared here.
const STORAGE_KEY = 'what-to-eat/v1';

type Saved = {
  favorites: Fave[];
  placeFaves: PlaceFave[];
  picks: PastPick[];
  signInOffered?: boolean;
};

const emptySaved: Saved = { favorites: [], placeFaves: [], picks: [] };

type Provider = 'apple' | 'google';

type DinnerStore = {
  ideas: Idea[];
  ideasById: Map<number, Idea>;
  favorites: Fave[];
  picks: PastPick[];
  loaded: boolean;
  isFave: (ideaId: number) => boolean;
  toggleFave: (ideaId: number) => void;
  lockIn: (ideaId: number) => void;
  /** Hearted real places (Fast food and Dine out). */
  placeFaves: PlaceFave[];
  isPlaceFave: (placeId: string) => boolean;
  togglePlaceFave: (place: PlaceRef) => void;
  lockInPlace: (place: PlaceRef) => void;

  backendConfigured: boolean;
  user: { name: string } | null;
  /** True while guest data is being copied into a freshly signed-in account. */
  syncing: boolean;
  signInVisible: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
  signIn: (provider: Provider) => Promise<void>;
  signOut: () => Promise<void>;
};

const StoreContext = createContext<DinnerStore | null>(null);

export function DinnerStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<Saved>(emptySaved);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [signInVisible, setSignInVisible] = useState(false);
  const importedFor = useRef<string | null>(null);
  const [importFailedFor, setImportFailedFor] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Saved>;
        setLocal({
          favorites: saved.favorites ?? [],
          placeFaves: saved.placeFaves ?? [],
          picks: saved.picks ?? [],
          signInOffered: saved.signInOffered,
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const updateLocal = (next: (prev: Saved) => Saved) => {
    setLocal((prev) => {
      const value = next(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {});
      return value;
    });
  };

  const userId = session?.user.id ?? null;
  const signedIn = userId != null;

  const ideasQuery = useQuery({
    queryKey: ['ideas'],
    queryFn: remote.fetchIdeas,
    enabled: backendConfigured,
    initialData: seedIdeas,
    initialDataUpdatedAt: 0,
    staleTime: 60 * 60 * 1000,
  });
  const ideas = ideasQuery.data.length > 0 ? ideasQuery.data : seedIdeas;
  const ideasById = new Map(ideas.map((idea) => [idea.id, idea]));

  const hasGuestData =
    local.favorites.length > 0 || local.placeFaves.length > 0 || local.picks.length > 0;
  // Wait for guest data to finish uploading before reading the account, so a read that
  // started mid-upload can't come back stale.
  const readServer = signedIn && loaded && (!hasGuestData || importFailedFor === userId);

  const favesKey = ['favorites', userId];
  const picksKey = ['picks', userId];
  const placeFavesKey = ['place-favorites', userId];
  const favesQuery = useQuery({
    queryKey: favesKey,
    queryFn: remote.fetchFavorites,
    enabled: readServer,
  });
  const picksQuery = useQuery({
    queryKey: picksKey,
    queryFn: remote.fetchPicks,
    enabled: readServer,
  });
  const placeFavesQuery = useQuery({
    queryKey: placeFavesKey,
    queryFn: remote.fetchPlaceFavorites,
    enabled: readServer,
  });

  // First time we see a signed-in user with guest data on this phone, copy it up.
  useEffect(() => {
    if (!userId || !loaded || !hasGuestData || importedFor.current === userId) return;
    importedFor.current = userId;
    const guest = { favorites: local.favorites, placeFaves: local.placeFaves, picks: local.picks };
    remote
      .importGuestData(guest, new Set(ideas.map((i) => i.id)))
      .then(() => {
        updateLocal((prev) => ({ ...prev, favorites: [], placeFaves: [], picks: [] }));
        for (const key of ['favorites', 'place-favorites', 'picks']) {
          queryClient.invalidateQueries({ queryKey: [key, userId] });
        }
      })
      // Keep the guest data, show the account alongside it, and try again next launch.
      .catch(() => setImportFailedFor(userId));
  });

  const favorites = signedIn ? mergeFaves(favesQuery.data ?? [], local.favorites) : local.favorites;
  const placeFaves = signedIn
    ? mergePlaceFaves(placeFavesQuery.data ?? [], local.placeFaves)
    : local.placeFaves;
  const picks = signedIn ? mergePicks(picksQuery.data ?? [], local.picks) : local.picks;
  const isFave = (ideaId: number) => favorites.some((f) => f.ideaId === ideaId);
  const isPlaceFave = (placeId: string) => placeFaves.some((f) => f.place.id === placeId);

  // Offer sign-in once, right after the very first heart of any kind.
  const offerSignIn = (adding: boolean) => {
    const offer =
      adding &&
      backendConfigured &&
      favorites.length + placeFaves.length === 0 &&
      !local.signInOffered;
    if (offer) setSignInVisible(true);
    return offer;
  };

  /** Signed in: update the cached list right away, then save, then refresh from the server. */
  function writeThrough<T>(
    key: unknown[],
    optimistic: (prev: T[]) => T[],
    save: () => Promise<void>
  ) {
    queryClient.setQueryData<T[]>(key, (prev = []) => optimistic(prev));
    save()
      .catch(() => {})
      .finally(() => queryClient.invalidateQueries({ queryKey: key }));
  }

  const toggleFaveAction = (ideaId: number) => {
    const removing = isFave(ideaId);
    if (!signedIn) {
      const offered = offerSignIn(!removing);
      updateLocal((prev) => ({
        ...prev,
        favorites: toggleFave(prev.favorites, ideaId, Date.now()),
        signInOffered: prev.signInOffered || offered,
      }));
      return;
    }
    writeThrough<Fave>(
      favesKey,
      (prev) => toggleFave(prev, ideaId, Date.now()),
      () => (removing ? remote.removeFavorite(ideaId) : remote.addFavorite(ideaId))
    );
  };

  const togglePlaceFaveAction = (place: PlaceRef) => {
    const removing = isPlaceFave(place.id);
    if (!signedIn) {
      const offered = offerSignIn(!removing);
      updateLocal((prev) => ({
        ...prev,
        placeFaves: togglePlaceFave(prev.placeFaves, place, Date.now()),
        signInOffered: prev.signInOffered || offered,
      }));
      return;
    }
    writeThrough<PlaceFave>(
      placeFavesKey,
      (prev) => togglePlaceFave(prev, place, Date.now()),
      () => (removing ? remote.removePlaceFavorite(place.id) : remote.addPlaceFavorite(place))
    );
  };

  const lockIn = (ideaId: number) => {
    if (!signedIn) {
      updateLocal((prev) => ({ ...prev, picks: addPick(prev.picks, ideaId, Date.now()) }));
      return;
    }
    writeThrough<PastPick>(
      picksKey,
      (prev) => addPick(prev, ideaId, Date.now()),
      () => remote.addPick(ideaId)
    );
  };

  const lockInPlace = (place: PlaceRef) => {
    if (!signedIn) {
      updateLocal((prev) => ({ ...prev, picks: addPlacePick(prev.picks, place, Date.now()) }));
      return;
    }
    writeThrough<PastPick>(
      picksKey,
      (prev) => addPlacePick(prev, place, Date.now()),
      () => remote.addPlacePick(place)
    );
  };

  const meta = session?.user.user_metadata ?? {};
  const name = (meta.full_name ?? meta.name ?? session?.user.email ?? 'you') as string;

  const store: DinnerStore = {
    ideas,
    ideasById,
    favorites,
    picks,
    loaded,
    isFave,
    toggleFave: toggleFaveAction,
    lockIn,
    placeFaves,
    isPlaceFave,
    togglePlaceFave: togglePlaceFaveAction,
    lockInPlace,
    backendConfigured,
    user: signedIn ? { name } : null,
    syncing: signedIn && hasGuestData && importFailedFor !== userId,
    signInVisible,
    openSignIn: () => setSignInVisible(true),
    closeSignIn: () => setSignInVisible(false),
    signIn: async (provider) => {
      const ok = await (provider === 'apple' ? auth.signInWithApple() : auth.signInWithGoogle());
      if (ok) setSignInVisible(false);
    },
    signOut: async () => {
      await auth.signOut();
      for (const key of ['favorites', 'place-favorites', 'picks']) {
        queryClient.removeQueries({ queryKey: [key] });
      }
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useDinnerStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useDinnerStore must be used inside DinnerStoreProvider');
  return store;
}
