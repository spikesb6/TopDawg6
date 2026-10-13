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
  picks: new Map<string, { id: string; ideaId: number; pickedAt: number }[]>(),
  reset() {
    this.favorites.clear();
    this.picks.clear();
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
  let nextId = 1;
  return {
    fetchIdeas: async () => seedIdeas,
    fetchFavorites: async () => [...faves()].sort((a, b) => b.createdAt - a.createdAt),
    fetchPicks: async () => [...picks()].sort((a, b) => b.pickedAt - a.pickedAt),
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
    importGuestData: jest.fn(async (guest: never, known: Set<number>) => {
      const rows = guestRows(guest, known);
      for (const f of rows.favorites) {
        if (!faves().some((x) => x.ideaId === f.idea_id))
          mockServer.favorites.set(mockUser(), [
            ...faves(),
            { ideaId: f.idea_id, createdAt: Date.parse(f.created_at) },
          ]);
      }
      for (const p of rows.picks) {
        mockServer.picks.set(mockUser(), [
          ...picks(),
          { id: `server-${nextId++}`, ideaId: p.idea_id, pickedAt: Date.parse(p.picked_at) },
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

const ids = (list: { ideaId: number }[]) => list.map((x) => x.ideaId).sort((a, b) => a - b);

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

    // A second fave does not ask again.
    await act(async () => phone1.result.current.toggleFave(3));
    expect(phone1.result.current.signInVisible).toBe(false);

    // Sign in: guest data is copied up and cleared from the phone.
    await act(async () => phone1.result.current.signIn('google'));
    await waitFor(() => expect(phone1.result.current.syncing).toBe(false));
    expect(phone1.result.current.user?.name).toBe('sam@example.com');
    expect(ids(mockServer.favorites.get('user-1')!)).toEqual([1, 3]);
    expect(ids(mockServer.picks.get('user-1')!)).toEqual([2]);
    await waitFor(() => expect(ids(phone1.result.current.favorites)).toEqual([1, 3]));
    const saved = JSON.parse((await AsyncStorage.getItem('what-to-eat/v1'))!);
    expect(saved.favorites).toEqual([]);
    expect(saved.picks).toEqual([]);

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

    // Signing out goes back to an empty guest.
    await act(async () => phone2.result.current.signOut());
    await waitFor(() => expect(phone2.result.current.user).toBeNull());
    expect(phone2.result.current.favorites).toEqual([]);
    expect(phone2.result.current.picks).toEqual([]);
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
});
