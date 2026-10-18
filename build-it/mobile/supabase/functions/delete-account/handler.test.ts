// Run with: npm run test:functions
import { assertEquals } from 'jsr:@std/assert@1';

import { createDeleteHandler } from './handler.ts';

function setup(fail?: 'files' | 'user') {
  const calls: string[] = [];
  const handler = createDeleteHandler({
    userIdFromToken: async (token) => (token === 'good-token' ? 'user-1' : null),
    deleteUserFiles: async (id) => {
      if (fail === 'files') throw new Error('boom');
      calls.push(`files:${id}`);
    },
    deleteUser: async (id) => {
      if (fail === 'user') throw new Error('boom');
      calls.push(`user:${id}`);
    },
  });
  const post = (auth?: string) =>
    handler(new Request('http://x/delete-account', { method: 'POST', headers: auth ? { Authorization: auth } : {} }));
  return { handler, post, calls };
}

Deno.test('deletes only the caller, photos first', async () => {
  const { post, calls } = setup();
  const res = await post('Bearer good-token');
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(calls, ['files:user-1', 'user:user-1']);
});

Deno.test('refuses without a valid sign-in', async () => {
  const { post, calls } = setup();
  for (const auth of [undefined, 'Bearer', 'Bearer bad-token', 'good-token']) {
    const res = await post(auth);
    assertEquals(res.status, 401, String(auth));
    await res.body?.cancel();
  }
  assertEquals(calls, []);
});

Deno.test('keeps the account when its photos could not be deleted', async () => {
  const { post, calls } = setup('files');
  const res = await post('Bearer good-token');
  assertEquals(res.status, 500);
  await res.body?.cancel();
  assertEquals(calls, []);
});

Deno.test('reports a failed delete and only accepts POST', async () => {
  const failing = setup('user');
  const res = await failing.post('Bearer good-token');
  assertEquals(res.status, 500);
  await res.body?.cancel();
  const get = await failing.handler(new Request('http://x', { method: 'GET' }));
  assertEquals(get.status, 405);
  await get.body?.cancel();
  const pre = await failing.handler(new Request('http://x', { method: 'OPTIONS' }));
  assertEquals(pre.status, 200);
  await pre.body?.cancel();
});
