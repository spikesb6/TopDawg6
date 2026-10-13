import type { Cost, Mood } from '@/data/ideas';

import type { Place, PlacesMode } from '../../supabase/functions/places/logic';

export type { Place, PlacesMode };

/** What we keep about a place in faves and past picks: the Google id, name and mode. */
export type PlaceRef = { id: string; name: string; mode: PlacesMode };

export const placeRef = (place: Place, mode: PlacesMode): PlaceRef => ({
  id: place.id,
  name: place.name,
  mode,
});

// Google cuisine types mapped to the app's moods, checked in this order.
const moodTypes: [Mood, string[]][] = [
  ['spicy', ['mexican_restaurant', 'thai_restaurant', 'indian_restaurant', 'korean_restaurant']],
  [
    'fresh',
    [
      'sushi_restaurant',
      'japanese_restaurant',
      'mediterranean_restaurant',
      'greek_restaurant',
      'middle_eastern_restaurant',
      'vegan_restaurant',
      'vegetarian_restaurant',
      'seafood_restaurant',
      'vietnamese_restaurant',
    ],
  ],
  [
    'comfy',
    [
      'pizza_restaurant',
      'hamburger_restaurant',
      'american_restaurant',
      'diner',
      'breakfast_restaurant',
      'brunch_restaurant',
      'italian_restaurant',
      'barbecue_restaurant',
      'steak_house',
      'sandwich_shop',
    ],
  ],
];

/** A mood for a place from its Google types, or null when nothing fits. */
export function placeMood(types: string[]): Mood | null {
  for (const [mood, list] of moodTypes) {
    if (types.some((t) => list.includes(t))) return mood;
  }
  return null;
}

/** Mood and budget filters combine, same as for ideas. Unknown price never matches a budget. */
export function filterPlaces(
  places: Place[],
  { mood, cost }: { mood?: Mood | null; cost?: Cost | null }
): Place[] {
  return places.filter(
    (p) => (mood == null || placeMood(p.types) === mood) && (cost == null || p.cost === cost)
  );
}

const MILES_REGIONS = ['US', 'GB', 'LR', 'MM'];

export function usesMiles(locale: string): boolean {
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  return region != null && MILES_REGIONS.includes(region);
}

export function formatDistance(meters: number, miles: boolean): string {
  if (miles) {
    const mi = meters / 1609.344;
    return mi < 0.1 ? 'Right here' : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  if (meters < 100) return 'Right here';
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * A link that opens the phone's maps app with directions. With coordinates, iPhone gets Apple
 * Maps and everything else Google Maps. A saved place (id and name only) opens in Google Maps.
 */
export function directionsUrl(
  place: { id: string; name: string; lat?: number | null; lng?: number | null },
  os: string
): string {
  const name = encodeURIComponent(place.name);
  const id = encodeURIComponent(place.id);
  if (place.lat != null && place.lng != null) {
    const at = `${place.lat},${place.lng}`;
    if (os === 'ios') return `https://maps.apple.com/?daddr=${at}&q=${name}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${at}&destination_place_id=${id}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${name}&query_place_id=${id}`;
}

/** The pills on a place: distance, budget and rating, when known. */
export function placeMeta(place: Place, miles: boolean): string[] {
  return [
    place.distanceMeters != null ? formatDistance(place.distanceMeters, miles) : null,
    place.cost != null ? '$'.repeat(place.cost) : null,
    place.rating != null ? `${place.rating.toFixed(1)} ★` : null,
  ].filter((x): x is string => x != null);
}
