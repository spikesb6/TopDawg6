import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { BuildState } from '@/lib/state';

import { AccountProvider, useAccount } from './account-store';
import { BuildStoreProvider, useBuild } from './build-store';

// A pretend account server: one saved build guarded by a version number, plus photo storage.
// Each renderHook below is a separate phone; nothing is saved on the phone between tests.
type MockSession = { user: { id: string; email: string } };
const mockAuth = {
  session: null as MockSession | null,
  listeners: new Set<(e: string, s: MockSession | null) => void>(),
  set(session: MockSession | null) {
    this.session = session;
    this.listeners.forEach((fn) => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
  },
};
const mockServer = {
  row: null as { data: BuildState; version: number } | null,
  photos: new Set<string>(),
  /** Photo files on "this phone" (the tests only ever give them to phone A). */
  localFiles: new Set<string>(),
  reset() {
    this.row = null;
    this.photos.clear();
    this.localFiles.clear();
  },
};
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => {},
}));

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

jest.mock('@/lib/photo-files', () => ({
  photosSupported: true,
  localPhotoUri: (id: string) => (mockServer.localFiles.has(id) ? `file:///${id}.jpg` : null),
  photoBytes: async () => new Uint8Array([1, 2, 3]),
}));

jest.mock('@/lib/remote', () => ({
  fetchBuild: async () => (mockServer.row ? copy(mockServer.row) : null),
  createBuild: async (_uid: string, data: BuildState) => {
    if (mockServer.row) return null;
    mockServer.row = { data: copy(data), version: 1 };
    return 1;
  },
  pushBuild: async (_uid: string, data: BuildState, expect: number) => {
    if (mockServer.row?.version !== expect) return null;
    mockServer.row = { data: copy(data), version: expect + 1 };
    return expect + 1;
  },
  uploadPhoto: async (uid: string, id: string) => void mockServer.photos.add(`${uid}/${id}.jpg`),
  signOut: async () => mockAuth.set(null),
  deleteAccount: async () => {
    mockServer.reset();
    mockAuth.set(null);
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <BuildStoreProvider>
    <AccountProvider>{children}</AccountProvider>
  </BuildStoreProvider>
);
const phone = async () => (await renderHook(() => ({ build: useBuild(), account: useAccount() }), { wrapper })).result;
type Phone = Awaited<ReturnType<typeof phone>>;
const signIn = () => act(() => mockAuth.set({ user: { id: 'user-1', email: 'sam@example.com' } }));
const check = (p: Phone, step: string) =>
  act(() => p.current.build.update((prev) => ({ ...prev, done: { ...prev.done, [step]: true } })));

beforeEach(() => {
  mockServer.reset();
  mockAuth.session = null;
  mockAuth.listeners.clear();
});

describe('cloud sync', () => {
  it('saves what you did before signing in, photos included', async () => {
    const a = await phone();
    await waitFor(() => expect(a.current.build.loaded).toBe(true));
    expect(a.current.account.status).toBe('signed-out');

    mockServer.localFiles.add('ph1');
    await check(a, 'f1');
    await act(() => a.current.build.update((prev) => ({ ...prev, photos: [{ id: 'ph1', step: 'fo3', takenAt: '2026-04-12', uploaded: false }] })));
    await signIn();

    await waitFor(() => expect(mockServer.photos.has('user-1/ph1.jpg')).toBe(true));
    await waitFor(() => expect(mockServer.row?.data.photos[0].uploaded).toBe(true));
    expect(mockServer.row?.data.done).toEqual({ f1: true });
    await waitFor(() => expect(a.current.build.meta.dirty).toBe(false));
  });

  it('a second phone picks up the build, and changes on both phones are merged', async () => {
    const a = await phone();
    await waitFor(() => expect(a.current.build.loaded).toBe(true));
    await check(a, 'f1');
    await signIn();
    await waitFor(() => expect(mockServer.row?.version).toBe(1));

    // Phone B starts empty and takes the account copy.
    const b = await phone();
    await waitFor(() => expect(b.current.build.state.done).toEqual({ f1: true }));
    expect(b.current.build.meta).toEqual({ dirty: false, version: 1 });

    // Both phones check a different step before either saves.
    await check(a, 'f2');
    await check(b, 'f3');
    await act(() => a.current.account.syncNow());
    await act(() => b.current.account.syncNow());
    expect(mockServer.row?.data.done).toEqual({ f1: true, f2: true, f3: true });

    // A catches up with B's step.
    await act(() => a.current.account.syncNow());
    expect(a.current.build.state.done).toEqual({ f1: true, f2: true, f3: true });
  });

  it('saves on its own shortly after a change', async () => {
    const a = await phone();
    await signIn();
    await waitFor(() => expect(a.current.account.status).toBe('synced'));
    await check(a, 'l1');
    await waitFor(() => expect(mockServer.row?.data.done).toEqual({ l1: true }), { timeout: 4000 });
  });

  it('keeps the build on the phone after sign-out and account deletion', async () => {
    const a = await phone();
    await check(a, 'f1');
    await signIn();
    await waitFor(() => expect(a.current.build.meta.version).toBe(1));

    await act(() => a.current.account.signOut());
    expect(a.current.account.status).toBe('signed-out');
    expect(a.current.build.meta).toEqual({ dirty: false, version: null });
    expect(a.current.build.state.done).toEqual({ f1: true });

    await signIn();
    await waitFor(() => expect(a.current.build.meta.version).toBe(1));
    await act(() => a.current.account.deleteAccount());
    expect(mockServer.row).toBeNull();
    expect(a.current.build.state.done).toEqual({ f1: true });
  });
});
