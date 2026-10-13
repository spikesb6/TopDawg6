import { describe, expect, it } from '@jest/globals';

import {
  directionsUrl,
  filterPlaces,
  formatDistance,
  placeMeta,
  placeMood,
  usesMiles,
  type Place,
} from './places';

const place = (id: string, types: string[], cost: Place['cost']): Place => ({
  id,
  name: id,
  address: null,
  lat: 1,
  lng: 2,
  cost,
  rating: null,
  ratingCount: null,
  typeLabel: null,
  types,
  mapsUri: null,
  distanceMeters: null,
});

describe('placeMood', () => {
  it('reads a mood from Google cuisine types', () => {
    expect(placeMood(['restaurant', 'thai_restaurant'])).toBe('spicy');
    expect(placeMood(['sushi_restaurant', 'food'])).toBe('fresh');
    expect(placeMood(['hamburger_restaurant', 'fast_food_restaurant'])).toBe('comfy');
    expect(placeMood(['restaurant', 'food'])).toBeNull();
  });
});

describe('filterPlaces', () => {
  const places = [
    place('tacos', ['mexican_restaurant'], 1),
    place('sushi', ['sushi_restaurant'], 3),
    place('burger', ['hamburger_restaurant'], 1),
    place('mystery', ['restaurant'], null),
  ];

  it('combines mood and budget', () => {
    expect(filterPlaces(places, {}).map((p) => p.id)).toHaveLength(4);
    expect(filterPlaces(places, { mood: 'spicy' }).map((p) => p.id)).toEqual(['tacos']);
    expect(filterPlaces(places, { cost: 1 }).map((p) => p.id)).toEqual(['tacos', 'burger']);
    expect(filterPlaces(places, { mood: 'comfy', cost: 1 }).map((p) => p.id)).toEqual(['burger']);
    expect(filterPlaces(places, { mood: 'fresh', cost: 1 })).toEqual([]);
  });

  it('never matches an unknown price to a budget', () => {
    expect(filterPlaces(places, { cost: 2 })).toEqual([]);
  });
});

describe('distance', () => {
  it('uses miles in the US and UK, km elsewhere', () => {
    expect(usesMiles('en-US')).toBe(true);
    expect(usesMiles('en_GB')).toBe(true);
    expect(usesMiles('fr-FR')).toBe(false);
    expect(usesMiles('en')).toBe(false);
  });

  it('formats short and long distances', () => {
    expect(formatDistance(50, true)).toBe('Right here');
    expect(formatDistance(1609, true)).toBe('1.0 mi');
    expect(formatDistance(30000, true)).toBe('19 mi');
    expect(formatDistance(50, false)).toBe('Right here');
    expect(formatDistance(640, false)).toBe('640 m');
    expect(formatDistance(2350, false)).toBe('2.4 km');
  });
});

describe('directionsUrl', () => {
  const p = { id: 'ChIJ1', name: 'Near Tacos & Co', lat: 40.7, lng: -74 };

  it('opens Apple Maps on iPhone and Google Maps elsewhere', () => {
    expect(directionsUrl(p, 'ios')).toBe(
      'https://maps.apple.com/?daddr=40.7,-74&q=Near%20Tacos%20%26%20Co'
    );
    expect(directionsUrl(p, 'android')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=40.7,-74&destination_place_id=ChIJ1'
    );
  });

  it('finds a saved place by id and name when there are no coordinates', () => {
    expect(directionsUrl({ id: 'ChIJ1', name: 'Near Tacos' }, 'ios')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Near%20Tacos&query_place_id=ChIJ1'
    );
  });
});

describe('placeMeta', () => {
  it('shows distance, budget and rating when known', () => {
    const p = { ...place('a', [], 2), distanceMeters: 805, rating: 4.46 };
    expect(placeMeta(p, true)).toEqual(['0.5 mi', '$$', '4.5 ★']);
    expect(placeMeta(place('b', [], null), true)).toEqual([]);
  });
});
