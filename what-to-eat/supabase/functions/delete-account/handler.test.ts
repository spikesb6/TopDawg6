// Run with: npm run test:functions
import { assertEquals } from 'jsr:@std/assert@1';

import { createDeleteHandler } from './handler.ts';

function setup(failDelete = false) {
  const deleted: string[] = [];
  const handler = createDeleteHandler({
    userIdFromToken: async (token) => (token === 'good-token' ? 'user-1' : null),
    deleteUser: async (id) => {
      if (failDelete) throw new Error('boom');
      deleted.push(id);
    },
  });
  const post = (auth?: string) =>
    handler(
      new Request('http://x/delete-account', {
        method: 'POST',
        headers: auth ? { Authorization: auth } : {},
      })
    );
  return { handler, post, deleted };
}

Deno.test('deletes only the user who owns the token', async () => {
  const { post, deleted } = setup();
  const res = await post('Bearer good-token');
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(deleted, ['user-1']);
});

Deno.test('refuses without a valid sign-in', async () => {
  const { post, deleted } = setup();
  for (const auth of [undefined, 'Bearer', 'Bearer bad-token', 'good-token']) {
    const res = await post(auth);
    assertEquals(res.status, 401, String(auth));
    await res.body?.cancel();
  }
  assertEquals(deleted, []);
});

Deno.test('reports a failed delete and only accepts POST', async () => {
  const failing = setup(true);
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
