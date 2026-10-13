/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as remote from '@/lib/remote';

import { DinnerStoreProvider, useDinnerStore } from './dinner-store';

// A pretend Supabase: one auth session at a time and an in-memory server keyed by user,
// so the same account can be opened on "two phones" one after the other.
type MockSession = { user: { id: string; email: string; user_metadata: object } };
const mockAuth = {
  session: null as MockSession | null,
  listeners: new Set<(e: string, s: MockSession | null) => void>(),
  set(session: MockSession | null) {
    this.session = session;
    this.listeners.forEach((fn) => fn('SIGNED_IN', session));
  },
};
const mockServer = {
  favorites: new Map<string, { ideaId: number; createdAt: number }[]>(),
  picks: new Map<
    string,
    {
      id: string;
      ideaId?: number;
      place?: { id: string; name: string; mode: 'fast' | 'dine' };
      pickedAt: number;
    }[]
  >(),
  placeFaves: new Map<
    string,
    { place: { id: string; name: string; mode: 'fast' | 'dine' }; createdAt: number }[]
  >(),
  reset() {
    this.favorites.clear();
    this.picks.clear();
    this.placeFaves.clear();
  },
};
const mockUser = () => mockAuth.session!.user.id;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@/lib/supabase', () => ({
  backendConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: mockAuth.session } }),
      onAuthStateChange: (fn: (e: string, s: MockSession | null) => void) => {
        mockAuth.listeners.add(fn);
        return { data: { subscription: { unsubscribe: () => mockAuth.listeners.delete(fn) } } };
      },
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  signInWithGoogle: async () => {
    mockAuth.set({ user: { id: 'user-1', email: 'sam@example.com', user_metadata: {} } });
    return true;
  },
  signInWithApple: async () => false,
  signOut: async () => mockAuth.set(null),
}));

jest.mock('@/lib/remote', () => {
  const { seedIdeas } = require('@/data/ideas');
  const { guestRows } = require('@/lib/sync');
  const faves = () => mockServer.favorites.get(mockUser()) ?? [];
  const picks = () => mockServer.picks.get(mockUser()) ?? [];
  const placeFaves = () => mockServer.placeFaves.get(mockUser()) ?? [];
  let nextId = 1;
  return {
    fetchIdeas: async () => seedIdeas,
    fetchFavorites: async () => [...faves()].sort((a, b) => b.createdAt - a.createdAt),
    fetchPicks: async () => [...picks()].sort((a, b) => b.pickedAt - a.pickedAt),
    fetchPlaceFavorites: async () => [...placeFaves()].sort((a, b) => b.createdAt - a.createdAt),
    addPlaceFavorite: async (place: { id: string; name: string; mode: 'fast' | 'dine' }) => {
      if (!placeFaves().some((f) => f.place.id === place.id))
        mockServer.placeFaves.set(mockUser(), [...placeFaves(), { place, createdAt: Date.now() }]);
    },
    removePlaceFavorite: async (placeId: string) => {
      mockServer.placeFaves.set(
        mockUser(),
        placeFaves().filter((f) => f.place.id !== placeId)
      );
    },
    addPlacePick: async (place: { id: string; name: string; mode: 'fast' | 'dine' }) => {
      mockServer.picks.set(mockUser(), [
        ...picks(),
        { id: `server-${nextId++}`, place, pickedAt: Date.now() },
      ]);
    },
    addFavorite: async (ideaId: number) => {
      if (!faves().some((f) => f.ideaId === ideaId))
        mockServer.favorites.set(mockUser(), [...faves(), { ideaId, createdAt: Date.now() }]);
    },
    removeFavorite: async (ideaId: number) => {
      mockServer.favorites.set(
        mockUser(),
        faves().filter((f) => f.ideaId !== ideaId)
      );
    },
    addPick: async (ideaId: number) => {
      mockServer.picks.set(mockUser(), [
        ...picks(),
        { id: `server-${nextId++}`, ideaId, pickedAt: Date.now() },
      ]);
    },
    deleteAccount: async () => {
      mockServer.favorites.delete(mockUser());
      mockServer.picks.delete(mockUser());
      mockServer.placeFaves.delete(mockUser());
    },
    importGuestData: jest.fn(async (guest: never, known: Set<number>) => {
      const rows = guestRows(guest, known);
      for (const f of rows.favorites) {
        if (!faves().some((x) => x.ideaId === f.idea_id))
          mockServer.favorites.set(mockUser(), [
            ...faves(),
            { ideaId: f.idea_id, createdAt: Date.parse(f.created_at) },
          ]);
      }
      for (const f of rows.placeFavorites) {
        mockServer.placeFaves.set(mockUser(), [
          ...placeFaves(),
          {
            place: { id: f.place_id, name: f.name, mode: f.mode },
            createdAt: Date.parse(f.created_at),
          },
        ]);
      }
      for (const p of rows.picks) {
        const place =
          'place_id' in p ? { id: p.place_id, name: p.place_name, mode: p.place_mode } : undefined;
        mockServer.picks.set(mockUser(), [
          ...picks(),
          place
            ? { id: `server-${nextId++}`, place, pickedAt: Date.parse(p.picked_at) }
            : { id: `server-${nextId++}`, ideaId: p.idea_id, pickedAt: Date.parse(p.picked_at) },
        ]);
      }
    }),
  };
});

/** A fresh app launch on a phone: new query cache, whatever AsyncStorage holds. */
async function launchApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DinnerStoreProvider>{children}</DinnerStoreProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useDinnerStore(), { wrapper });
}

const ids = (list: { ideaId?: number }[]) =>
  list.flatMap((x) => (x.ideaId != null ? [x.ideaId] : [])).sort((a, b) => a - b);
const placeIds = (list: { place?: { id: string } }[]) =>
  list.flatMap((x) => (x.place ? [x.place.id] : [])).sort();
const tacos = { id: 'gp-1', name: 'Near Tacos', mode: 'fast' as const };

describe('faves and past picks follow the user to a second phone', () => {
  beforeEach(async () => {
    mockAuth.session = null;
    mockAuth.listeners.clear();
    mockServer.reset();
    await AsyncStorage.clear();
  });

  it('keeps guest data on the phone, uploads it at sign-in, and shows it on another phone', async () => {
    // Phone 1, guest mode.
    const phone1 = await launchApp();
    await waitFor(() => expect(phone1.result.current.loaded).toBe(true));
    expect(phone1.result.current.user).toBeNull();

    await act(async () => phone1.result.current.toggleFave(1));
    expect(ids(phone1.result.current.favorites)).toEqual([1]);
    // The first fave offers sign-in.
    expect(phone1.result.current.signInVisible).toBe(true);
    await act(async () => phone1.result.current.closeSignIn());

    await act(async () => phone1.result.current.lockIn(2));
    expect(ids(phone1.result.current.picks)).toEqual([2]);
    expect(mockServer.favorites.size).toBe(0);

    // A second fave does not ask again, including a place.
    await act(async () => phone1.result.current.toggleFave(3));
    await act(async () => phone1.result.current.togglePlaceFave(tacos));
    await act(async () => phone1.result.current.lockInPlace(tacos));
    expect(phone1.result.current.signInVisible).toBe(false);
    expect(phone1.result.current.isPlaceFave('gp-1')).toBe(true);
    expect(placeIds(phone1.result.current.picks)).toEqual(['gp-1']);

    // Sign in: guest data is copied up and cleared from the phone.
    await act(async () => phone1.result.current.signIn('google'));
    await waitFor(() => expect(phone1.result.current.syncing).toBe(false));
    expect(phone1.result.current.user?.name).toBe('sam@example.com');
    expect(ids(mockServer.favorites.get('user-1')!)).toEqual([1, 3]);
    expect(ids(mockServer.picks.get('user-1')!)).toEqual([2]);
    expect(placeIds(mockServer.picks.get('user-1')!)).toEqual(['gp-1']);
    expect(mockServer.placeFaves.get('user-1')!.map((f) => f.place)).toEqual([tacos]);
    await waitFor(() => expect(ids(phone1.result.current.favorites)).toEqual([1, 3]));
    const saved = JSON.parse((await AsyncStorage.getItem('what-to-eat/v1'))!);
    expect(saved.favorites).toEqual([]);
    expect(saved.picks).toEqual([]);
    expect(saved.placeFaves).toEqual([]);

    // Signed in: hearts and picks go straight to the server.
    await act(async () => phone1.result.current.toggleFave(5));
    await act(async () => phone1.result.current.toggleFave(1));
    await act(async () => phone1.result.current.lockIn(7));
    await waitFor(() => expect(ids(mockServer.favorites.get('user-1')!)).toEqual([3, 5]));
    await waitFor(() => expect(ids(mockServer.picks.get('user-1')!)).toEqual([2, 7]));
    await phone1.unmount();

    // Phone 2: nothing on the device, same account.
    await AsyncStorage.clear();
    mockAuth.listeners.clear();
    const phone2 = await launchApp();
    await waitFor(() => expect(ids(phone2.result.current.favorites)).toEqual([3, 5]));
    await waitFor(() => expect(ids(phone2.result.current.picks)).toEqual([2, 7]));
    expect(phone2.result.current.isFave(5)).toBe(true);
    await waitFor(() => expect(phone2.result.current.isPlaceFave('gp-1')).toBe(true));
    expect(placeIds(phone2.result.current.picks)).toEqual(['gp-1']);

    // Un-hearting the place on phone 2 removes it from the account.
    await act(async () => phone2.result.current.togglePlaceFave(tacos));
    await waitFor(() => expect(mockServer.placeFaves.get('user-1')).toEqual([]));

    // Signing out goes back to an empty guest.
    await act(async () => phone2.result.current.signOut());
    await waitFor(() => expect(phone2.result.current.user).toBeNull());
    expect(phone2.result.current.favorites).toEqual([]);
    expect(phone2.result.current.picks).toEqual([]);
    expect(phone2.result.current.placeFaves).toEqual([]);
  });

  it('offers sign-in when the first heart is a place', async () => {
    const phone = await launchApp();
    await waitFor(() => expect(phone.result.current.loaded).toBe(true));
    await act(async () => phone.result.current.togglePlaceFave(tacos));
    expect(phone.result.current.signInVisible).toBe(true);
    await phone.unmount();
  });

  it('keeps guest data on the phone if the upload fails, and still shows the account', async () => {
    mockServer.favorites.set('user-1', [{ ideaId: 9, createdAt: 1 }]);
    jest.mocked(remote.importGuestData).mockRejectedValueOnce(new Error('offline'));

    const phone = await launchApp();
    await waitFor(() => expect(phone.result.current.loaded).toBe(true));
    await act(async () => phone.result.current.toggleFave(4));
    await act(async () => phone.result.current.signIn('google'));

    await waitFor(() => expect(ids(phone.result.current.favorites)).toEqual([4, 9]));
    expect(phone.result.current.syncing).toBe(false);
    const saved = JSON.parse((await AsyncStorage.getItem('what-to-eat/v1'))!);
    expect(saved.favorites.map((f: { ideaId: number }) => f.ideaId)).toEqual([4]);
    await phone.unmount();
  });

  it('deletes the account and everything saved to it', async () => {
    const phone = await launchApp();
    await waitFor(() => expect(phone.result.current.loaded).toBe(true));
    await act(async () => phone.result.current.signIn('google'));
    await waitFor(() => expect(phone.result.current.user).not.toBeNull());
    await act(async () => phone.result.current.toggleFave(2));
    await act(async () => phone.result.current.lockInPlace(tacos));
    await waitFor(() => expect(mockServer.favorites.get('user-1')?.length).toBe(1));

    await act(async () => phone.result.current.deleteAccount());
    await waitFor(() => expect(phone.result.current.user).toBeNull());
    expect(mockServer.favorites.has('user-1')).toBe(false);
    expect(mockServer.picks.has('user-1')).toBe(false);
    expect(phone.result.current.favorites).toEqual([]);
    expect(phone.result.current.picks).toEqual([]);
    await phone.unmount();
  });
});
