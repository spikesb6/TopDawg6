// Pure helpers for the places function. No imports, so both the Edge Function (Deno) and the
// app (for the Place type) can use this file.

export type PlacesMode = 'fast' | 'dine';

export type PlacesRequest =
  | { mode: PlacesMode; lat: number; lng: number }
  | { mode: PlacesMode; city: string };

export type Place = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** 1 to 3, like the $ / $$ / $$$ budget chips. Null when Google doesn't say. */
  cost: 1 | 2 | 3 | null;
  rating: number | null;
  ratingCount: number | null;
  typeLabel: string | null;
  types: string[];
  mapsUri: string | null;
  /** Straight-line distance from the person, when we know where they are. */
  distanceMeters: number | null;
};

export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  googleMapsUri?: string;
};

export const SEARCH_RADIUS_METERS = 5000;
export const CACHE_TTL_MS = 15 * 60 * 1000;
export const MAX_RESULTS = 20;

export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.googleMapsUri',
].join(',');

const isMode = (m: unknown): m is PlacesMode => m === 'fast' || m === 'dine';
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Checks the request body. Returns an error message when it isn't usable. */
export function parseRequest(body: unknown): PlacesRequest | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Send a JSON body.' };
  const b = body as Record<string, unknown>;
  if (!isMode(b.mode)) return { error: 'mode must be "fast" or "dine".' };
  if (isNum(b.lat) && isNum(b.lng)) {
    if (Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180) return { error: 'lat/lng out of range.' };
    return { mode: b.mode, lat: b.lat, lng: b.lng };
  }
  if (typeof b.city === 'string') {
    const city = b.city.trim().replace(/\s+/g, ' ');
    if (city.length === 0 || city.length > 100) return { error: 'city must be 1 to 100 characters.' };
    return { mode: b.mode, city };
  }
  return { error: 'Send lat and lng, or a city.' };
}

/** Nearby requests share a cache entry within about 100 m (3 decimal places). */
export function cacheKey(req: PlacesRequest): string {
  if ('city' in req) return `${req.mode}:city:${req.city.toLowerCase()}`;
  return `${req.mode}:${req.lat.toFixed(3)},${req.lng.toFixed(3)}`;
}

/** The Places API (New) call for this request. */
export function googleRequest(req: PlacesRequest): { url: string; body: Record<string, unknown> } {
  const type = req.mode === 'fast' ? 'fast_food_restaurant' : 'restaurant';
  if ('city' in req) {
    return {
      url: 'https://places.googleapis.com/v1/places:searchText',
      body: {
        textQuery: `${req.mode === 'fast' ? 'fast food' : 'restaurants'} in ${req.city}`,
        includedType: type,
        openNow: true,
        pageSize: MAX_RESULTS,
      },
    };
  }
  return {
    url: 'https://places.googleapis.com/v1/places:searchNearby',
    body: {
      includedTypes: [type],
      ...(req.mode === 'dine' ? { excludedPrimaryTypes: ['fast_food_restaurant'] } : {}),
      maxResultCount: MAX_RESULTS,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: req.lat, longitude: req.lng },
          radius: SEARCH_RADIUS_METERS,
        },
      },
    },
  };
}

export function priceToCost(level: string | undefined): 1 | 2 | 3 | null {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 3;
    default:
      return null;
  }
}

/** Great-circle distance in meters. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Keeps only places Google says are open right now, in our own shape. */
export function normalizePlaces(raw: { places?: GooglePlace[] } | null | undefined): Place[] {
  return (raw?.places ?? [])
    .filter((p) => p.id && p.displayName?.text && p.currentOpeningHours?.openNow === true)
    .map((p) => ({
      id: p.id!,
      name: p.displayName!.text!,
      address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      cost: priceToCost(p.priceLevel),
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      typeLabel: p.primaryTypeDisplayName?.text ?? null,
      types: p.types ?? [],
      mapsUri: p.googleMapsUri ?? null,
      distanceMeters: null,
    }));
}

/** Adds distance from the person and sorts nearest first. City searches keep Google's order. */
export function withDistance(places: Place[], req: PlacesRequest): Place[] {
  if ('city' in req) return places.map((p) => ({ ...p, distanceMeters: null }));
  const origin = { lat: req.lat, lng: req.lng };
  return places
    .map((p) => ({
      ...p,
      distanceMeters:
        p.lat != null && p.lng != null ? distanceMeters(origin, { lat: p.lat, lng: p.lng }) : null,
    }))
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
}
