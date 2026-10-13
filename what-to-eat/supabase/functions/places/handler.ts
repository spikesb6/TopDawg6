import {
  CACHE_TTL_MS,
  FIELD_MASK,
  cacheKey,
  googleRequest,
  normalizePlaces,
  parseRequest,
  withDistance,
  type Place,
} from './logic.ts';

export type PlacesCache = {
  get(key: string): Promise<{ places: Place[]; createdAt: number } | null>;
  set(key: string, places: Place[]): Promise<void>;
};

type Deps = {
  apiKey: string | undefined;
  fetch: typeof fetch;
  cache: PlacesCache;
  now: () => number;
  log?: (message: string) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * POST { mode: 'fast' | 'dine', lat, lng } or { mode, city } and get back
 * { places: Place[] } that are open now. The Google key never leaves the server.
 */
export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

    const parsed = parseRequest(await req.json().catch(() => null));
    if ('error' in parsed) return json({ error: parsed.error }, 400);
    if (!deps.apiKey) return json({ error: 'Places is not set up yet.' }, 500);

    const key = cacheKey(parsed);
    const cached = await deps.cache.get(key).catch(() => null);
    if (cached && deps.now() - cached.createdAt < CACHE_TTL_MS) {
      return json({ places: withDistance(cached.places, parsed), cached: true });
    }

    const google = googleRequest(parsed);
    let res: Response;
    try {
      res = await deps.fetch(google.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': deps.apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(google.body),
      });
    } catch (e) {
      deps.log?.(`Google Places unreachable: ${e}`);
      return json({ error: 'Could not reach Google Places.' }, 502);
    }
    if (!res.ok) {
      deps.log?.(`Google Places ${res.status}: ${await res.text().catch(() => '')}`);
      return json({ error: 'Google Places request failed.' }, 502);
    }

    const places = normalizePlaces(await res.json());
    await deps.cache.set(key, places).catch(() => {});
    return json({ places: withDistance(places, parsed), cached: false });
  };
}
