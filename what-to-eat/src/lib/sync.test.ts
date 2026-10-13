import { describe, expect, it } from '@jest/globals';

import {
  faveFromRow,
  guestRows,
  ideaFromRow,
  mergeFaves,
  mergePicks,
  mergePlaceFaves,
  pickFromRow,
  placeFaveFromRow,
} from './sync';

describe('row mapping', () => {
  it('turns an ideas row into an Idea, filling empty columns', () => {
    expect(
      ideaFromRow({
        id: 4,
        mode: 'dine',
        name: 'Sushi',
        blurb: 'Treat yourself',
        mood: 'fresh',
        cost: 3,
        minutes: null,
        details: null,
      })
    ).toEqual({
      id: 4,
      mode: 'dine',
      name: 'Sushi',
      blurb: 'Treat yourself',
      mood: 'fresh',
      cost: 3,
      minutes: 0,
      details: '',
    });
  });

  it('turns favorites and picks rows into app shapes', () => {
    expect(faveFromRow({ idea_id: 7, created_at: '2026-10-13T18:00:00.000Z' })).toEqual({
      ideaId: 7,
      createdAt: Date.parse('2026-10-13T18:00:00.000Z'),
    });
    expect(pickFromRow({ id: 12, idea_id: 3, picked_at: '2026-10-12T19:30:00.000Z' })).toEqual({
      id: 'server-12',
      ideaId: 3,
      pickedAt: Date.parse('2026-10-12T19:30:00.000Z'),
    });
  });
});

describe('guestRows', () => {
  const t = Date.parse('2026-10-10T19:00:00.000Z');

  it('keeps timestamps, drops duplicate hearts and unknown ideas', () => {
    const rows = guestRows(
      {
        favorites: [
          { ideaId: 1, createdAt: t },
          { ideaId: 1, createdAt: t + 1 },
          { ideaId: 99, createdAt: t },
        ],
        picks: [
          { id: 'a', ideaId: 2, pickedAt: t },
          { id: 'b', ideaId: 2, pickedAt: t + 1000 },
          { id: 'c', ideaId: 99, pickedAt: t },
        ],
      },
      new Set([1, 2])
    );
    expect(rows.favorites).toEqual([{ idea_id: 1, created_at: '2026-10-10T19:00:00.000Z' }]);
    expect(rows.picks).toEqual([
      { idea_id: 2, picked_at: '2026-10-10T19:00:00.000Z' },
      { idea_id: 2, picked_at: '2026-10-10T19:00:01.000Z' },
    ]);
  });

  it('returns nothing for an empty guest', () => {
    expect(guestRows({ favorites: [], picks: [] }, new Set([1]))).toEqual({
      favorites: [],
      placeFavorites: [],
      picks: [],
    });
  });
});

describe('merging guest data while it uploads', () => {
  it('unions faves by idea, newest first', () => {
    expect(
      mergeFaves(
        [
          { ideaId: 1, createdAt: 10 },
          { ideaId: 2, createdAt: 30 },
        ],
        [
          { ideaId: 2, createdAt: 5 },
          { ideaId: 3, createdAt: 20 },
        ]
      )
    ).toEqual([
      { ideaId: 2, createdAt: 30 },
      { ideaId: 3, createdAt: 20 },
      { ideaId: 1, createdAt: 10 },
    ]);
  });

  it('keeps every pick, newest first', () => {
    expect(
      mergePicks(
        [{ id: 'server-1', ideaId: 1, pickedAt: 10 }],
        [{ id: 'a', ideaId: 1, pickedAt: 20 }]
      ).map((p) => p.id)
    ).toEqual(['a', 'server-1']);
  });
});

describe('places', () => {
  const tacos = { id: 'gp-1', name: 'Near Tacos', mode: 'fast' as const };

  it('maps place picks and place favorites from rows', () => {
    expect(
      pickFromRow({
        id: 3,
        idea_id: null,
        place_id: 'gp-1',
        place_name: 'Near Tacos',
        place_mode: 'fast',
        picked_at: '2026-10-12T19:30:00.000Z',
      })
    ).toEqual({ id: 'server-3', place: tacos, pickedAt: Date.parse('2026-10-12T19:30:00.000Z') });
    expect(
      placeFaveFromRow({
        place_id: 'gp-1',
        name: 'Near Tacos',
        mode: 'fast',
        created_at: '2026-10-12T19:30:00.000Z',
      })
    ).toEqual({ place: tacos, createdAt: Date.parse('2026-10-12T19:30:00.000Z') });
  });

  it('uploads guest place faves and place picks', () => {
    const t = Date.parse('2026-10-10T19:00:00.000Z');
    const rows = guestRows(
      {
        favorites: [],
        placeFaves: [
          { place: tacos, createdAt: t },
          { place: tacos, createdAt: t + 1 },
        ],
        picks: [{ id: 'a', place: tacos, pickedAt: t }],
      },
      new Set()
    );
    expect(rows.placeFavorites).toEqual([
      {
        place_id: 'gp-1',
        name: 'Near Tacos',
        mode: 'fast',
        created_at: '2026-10-10T19:00:00.000Z',
      },
    ]);
    expect(rows.picks).toEqual([
      {
        place_id: 'gp-1',
        place_name: 'Near Tacos',
        place_mode: 'fast',
        picked_at: '2026-10-10T19:00:00.000Z',
      },
    ]);
  });

  it('merges place faves while uploading', () => {
    expect(
      mergePlaceFaves([{ place: tacos, createdAt: 5 }], [{ place: tacos, createdAt: 1 }])
    ).toEqual([{ place: tacos, createdAt: 5 }]);
  });
});
