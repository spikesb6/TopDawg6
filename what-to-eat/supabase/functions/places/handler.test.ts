// Run with: npm run test:functions
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { createHandler, type PlacesCache } from './handler.ts';
import { CACHE_TTL_MS, type GooglePlace, type Place } from './logic.ts';

const here = { lat: 40.7128, lng: -74.006 };

const google = ({
  id,
  name,
  lat,
  ...overrides
}: Partial<GooglePlace> & { id: string; name: string; lat: number }): GooglePlace => ({
  id,
  displayName: { text: name },
  formattedAddress: '1 Main St',
  location: { latitude: lat, longitude: here.lng },
  priceLevel: 'PRICE_LEVEL_MODERATE',
  rating: 4.5,
  userRatingCount: 120,
  currentOpeningHours: { openNow: true },
  primaryTypeDisplayName: { text: 'Burger Restaurant' },
  types: ['hamburger_restaurant', 'fast_food_restaurant'],
  googleMapsUri: `https://maps.google.com/?cid=${id}`,
  ...overrides,
});

function setup(opts: { apiKey?: string; response?: () => Response } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const store = new Map<string, { places: Place[]; createdAt: number }>();
  let clock = 1_000_000;
  const cache: PlacesCache = {
    get: async (k) => store.get(k) ?? null,
    set: async (k, places) => void store.set(k, { places, createdAt: clock }),
  };
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return opts.response
      ? opts.response()
      : Response.json({
          places: [
            google({ id: 'far', name: 'Far Burgers', lat: here.lat + 0.02 }),
            google({ id: 'near', name: 'Near Tacos', lat: here.lat + 0.001 }),
            google({
              id: 'closed',
              name: 'Closed Diner',
              lat: here.lat,
              currentOpeningHours: { openNow: false },
            }),
            google({ id: 'nohours', name: 'Mystery Spot', lat: here.lat, currentOpeningHours: undefined }),
          ],
        });
  }) as typeof fetch;
  const handler = createHandler({
    apiKey: 'apiKey' in opts ? opts.apiKey : 'test-key',
    fetch: fakeFetch,
    cache,
    now: () => clock,
  });
  const post = (body: unknown) =>
    handler(new Request('http://x/places', { method: 'POST', body: JSON.stringify(body) }));
  return { handler, post, calls, advance: (ms: number) => (clock += ms) };
}

Deno.test('returns only open places, nearest first, with distance and our shape', async () => {
  const { post, calls } = setup();
  const res = await post({ mode: 'fast', ...here });
  assertEquals(res.status, 200);
  const { places, cached } = await res.json();
  assertEquals(cached, false);
  assertEquals(
    places.map((p: Place) => p.id),
    ['near', 'far']
  );
  assertEquals(places[0].cost, 2);
  assertEquals(places[0].typeLabel, 'Burger Restaurant');
  assert(places[0].distanceMeters > 100 && places[0].distanceMeters < 120);
  assert(places[1].distanceMeters > 2200 && places[1].distanceMeters < 2250);

  // The Google key and field mask go in headers, never in the response.
  const headers = calls[0].init.headers as Record<string, string>;
  assertEquals(headers['X-Goog-Api-Key'], 'test-key');
  assert(headers['X-Goog-FieldMask'].includes('places.currentOpeningHours.openNow'));
  assert(!JSON.stringify(places).includes('test-key'));
});

Deno.test('nearby search for fast food, text search with openNow for a city', async () => {
  const { post, calls } = setup();
  await post({ mode: 'fast', ...here });
  await post({ mode: 'dine', city: '  Portland,   OR ' });
  assert(calls[0].url.endsWith('places:searchNearby'));
  const nearby = JSON.parse(String(calls[0].init.body));
  assertEquals(nearby.includedTypes, ['fast_food_restaurant']);
  assertEquals(nearby.locationRestriction.circle.center, { latitude: here.lat, longitude: here.lng });

  assert(calls[1].url.endsWith('places:searchText'));
  const text = JSON.parse(String(calls[1].init.body));
  assertEquals(text.textQuery, 'restaurants in Portland, OR');
  assertEquals(text.openNow, true);
});

Deno.test('city results have no distance', async () => {
  const { post } = setup();
  const { places } = await (await post({ mode: 'dine', city: 'Austin' })).json();
  assertEquals(
    places.map((p: Place) => p.distanceMeters),
    [null, null]
  );
});

Deno.test('serves repeat requests from the cache for 15 minutes', async () => {
  const { post, calls, advance } = setup();
  await post({ mode: 'fast', ...here });
  // A few meters away still hits the same cache entry.
  const again = await (await post({ mode: 'fast', lat: here.lat + 0.0001, lng: here.lng })).json();
  assertEquals(again.cached, true);
  assertEquals(calls.length, 1);

  advance(CACHE_TTL_MS + 1);
  const later = await (await post({ mode: 'fast', ...here })).json();
  assertEquals(later.cached, false);
  assertEquals(calls.length, 2);
});

Deno.test('rejects bad input', async () => {
  const { post, handler } = setup();
  for (const body of [null, {}, { mode: 'cook', ...here }, { mode: 'fast' }, { mode: 'fast', lat: 99, lng: 0 }, { mode: 'fast', city: ' ' }]) {
    assertEquals((await post(body)).status, 400, JSON.stringify(body));
  }
  assertEquals((await handler(new Request('http://x', { method: 'GET' }))).status, 405);
});

Deno.test('answers the browser preflight', async () => {
  const { handler } = setup();
  const res = await handler(new Request('http://x', { method: 'OPTIONS' }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  await res.body?.cancel();
});

Deno.test('explains a missing key or a Google failure without leaking details', async () => {
  const noKey = setup({ apiKey: undefined });
  assertEquals((await noKey.post({ mode: 'fast', ...here })).status, 500);
  assertEquals(noKey.calls.length, 0);

  const failing = setup({ response: () => new Response('quota exceeded', { status: 429 }) });
  const res = await failing.post({ mode: 'fast', ...here });
  assertEquals(res.status, 502);
  assertEquals(await res.json(), { error: 'Google Places request failed.' });
});
