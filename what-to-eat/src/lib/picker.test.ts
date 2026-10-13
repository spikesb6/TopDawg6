import { describe, expect, it } from '@jest/globals';

import { seedIdeas as ideas } from '../data/ideas';
import {
  addPick,
  addPlacePick,
  costLabel,
  filterIdeas,
  pickRandom,
  recentIdeaIds,
  relativeDay,
  surprisePool,
  toggleFave,
  togglePlaceFave,
  type PastPick,
} from './picker';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 13, 19, 0).getTime();

describe('seed ideas', () => {
  it('has 28 ideas, seven per mode, with unique ids', () => {
    expect(ideas).toHaveLength(28);
    expect(new Set(ideas.map((i) => i.id)).size).toBe(28);
    for (const mode of ['cook', 'fast', 'dine', 'deliv'] as const) {
      expect(ideas.filter((i) => i.mode === mode)).toHaveLength(7);
    }
  });

  it('keeps every Cook it idea at 30 minutes or less', () => {
    expect(ideas.filter((i) => i.mode === 'cook').every((i) => i.minutes <= 30)).toBe(true);
  });
});

describe('filterIdeas', () => {
  it('returns everything with no filters', () => {
    expect(filterIdeas(ideas, {})).toHaveLength(28);
  });

  it('combines mode, mood and budget', () => {
    const result = filterIdeas(ideas, { mode: 'cook', mood: 'spicy', cost: 1 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.mode === 'cook' && i.mood === 'spicy' && i.cost === 1)).toBe(true);
  });

  it('can match nothing', () => {
    expect(filterIdeas(ideas, { mode: 'cook', cost: 3 })).toEqual([]);
  });
});

describe('7-day rule', () => {
  const picks: PastPick[] = [
    { id: 'a', ideaId: 1, pickedAt: now - 2 * DAY },
    { id: 'b', ideaId: 2, pickedAt: now - 7 * DAY + 60_000 },
    { id: 'c', ideaId: 3, pickedAt: now - 8 * DAY },
  ];

  it('counts only picks from the last 7 days', () => {
    expect([...recentIdeaIds(picks, now)].sort()).toEqual([1, 2]);
  });

  it('leaves recent picks out of the Surprise me pool', () => {
    const pool = surprisePool(ideas, picks, now);
    expect(pool.map((i) => i.id)).not.toContain(1);
    expect(pool.map((i) => i.id)).not.toContain(2);
    expect(pool.map((i) => i.id)).toContain(3);
    expect(pool).toHaveLength(26);
  });

  it('falls back to every idea when all of them were picked this week', () => {
    const all = ideas.map((i) => ({ id: String(i.id), ideaId: i.id, pickedAt: now - DAY }));
    expect(surprisePool(ideas, all, now)).toHaveLength(28);
  });
});

describe('pickRandom', () => {
  it('never repeats the current idea', () => {
    const pool = ideas.slice(0, 3);
    for (const r of [0, 0.3, 0.5, 0.7, 0.9999]) {
      expect(pickRandom(pool, pool[0].id, () => r)?.id).not.toBe(pool[0].id);
    }
  });

  it('returns null when the current idea is the only option', () => {
    expect(pickRandom([ideas[0]], ideas[0].id)).toBeNull();
    expect(pickRandom([])).toBeNull();
  });

  it('can pick any idea when nothing is excluded', () => {
    const pool = ideas.slice(0, 4);
    expect(pickRandom(pool, null, () => 0)?.id).toBe(pool[0].id);
    expect(pickRandom(pool, null, () => 0.99)?.id).toBe(pool[3].id);
  });
});

describe('relativeDay', () => {
  it('says Today, Yesterday or N days ago by calendar day', () => {
    expect(relativeDay(now - 60_000, now)).toBe('Today');
    expect(relativeDay(new Date(2026, 9, 13, 0, 5).getTime(), now)).toBe('Today');
    expect(relativeDay(new Date(2026, 9, 12, 23, 55).getTime(), now)).toBe('Yesterday');
    expect(relativeDay(now - 3 * DAY, now)).toBe('3 days ago');
  });
});

describe('faves and picks', () => {
  it('toggles a fave on and off', () => {
    const on = toggleFave([], 5, now);
    expect(on).toEqual([{ ideaId: 5, createdAt: now }]);
    expect(toggleFave(on, 5, now)).toEqual([]);
  });

  it('adds the newest pick first', () => {
    const picks = addPick(addPick([], 1, now - DAY), 2, now);
    expect(picks.map((p) => p.ideaId)).toEqual([2, 1]);
  });

  it('formats budget', () => {
    expect(costLabel(1)).toBe('$');
    expect(costLabel(3)).toBe('$$$');
  });
});

describe('places in faves and picks', () => {
  const tacos = { id: 'gp-1', name: 'Near Tacos', mode: 'fast' as const };

  it('toggles a place fave', () => {
    const on = togglePlaceFave([], tacos, now);
    expect(on).toEqual([{ place: tacos, createdAt: now }]);
    expect(togglePlaceFave(on, tacos, now)).toEqual([]);
  });

  it('records a place pick that the 7-day rule ignores', () => {
    const picks = addPlacePick(addPick([], 1, now), tacos, now);
    expect(picks[0]).toEqual({ id: `${now}-gp-1`, place: tacos, pickedAt: now });
    expect([...recentIdeaIds(picks, now)]).toEqual([1]);
  });

  it('picks places too, never repeating the current one', () => {
    const pool = [{ id: 'a' }, { id: 'b' }];
    expect(pickRandom(pool, 'a', () => 0)?.id).toBe('b');
  });
});
