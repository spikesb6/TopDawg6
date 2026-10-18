import * as SecureStore from 'expo-secure-store';

// SecureStore warns past ~2KB per value and a Supabase session can be bigger,
// so long values are split across numbered keys.
const CHUNK = 1800;

export function splitIntoChunks(value: string, size = CHUNK): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks.length > 0 ? chunks : [''];
}

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function removeChunks(key: string) {
  const count = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i)))
  );
  await SecureStore.deleteItemAsync(countKey(key));
}

export const secureStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i)))
    );
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    await removeChunks(key);
    const chunks = splitIntoChunks(value);
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(key, i), c)));
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },
  async removeItem(key: string) {
    await removeChunks(key);
  },
};
