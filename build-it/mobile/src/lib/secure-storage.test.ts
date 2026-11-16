import { describe, expect, it, jest } from '@jest/globals';

import { secureStorage, splitIntoChunks } from './secure-storage';

// jest.mock is hoisted above the imports.
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));

describe('secureStorage', () => {
  it('splits long values into chunks', () => {
    expect(splitIntoChunks('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
    expect(splitIntoChunks('', 3)).toEqual(['']);
  });

  it('round-trips a long value and cleans up old chunks', async () => {
    const long = 'x'.repeat(5000);
    await secureStorage.setItem('sb-token', long);
    expect(await secureStorage.getItem('sb-token')).toBe(long);
    await secureStorage.setItem('sb-token', 'short');
    expect(await secureStorage.getItem('sb-token')).toBe('short');
    expect([...mockStore.keys()].sort()).toEqual(['sb-token.0', 'sb-token.count']);
    await secureStorage.removeItem('sb-token');
    expect(await secureStorage.getItem('sb-token')).toBeNull();
    expect(mockStore.size).toBe(0);
  });
});
