import type { ModeKey } from '@/theme/theme';

import seed from './seed-ideas.json';

export type Mood = 'comfy' | 'fresh' | 'spicy';
export type Cost = 1 | 2 | 3;

export type Ingredient = { qty: string; name: string };

export type Idea = {
  id: number;
  mode: ModeKey;
  name: string;
  blurb: string;
  mood: Mood;
  cost: Cost;
  minutes: number;
  details: string;
  /** Cook it ideas carry a recipe. */
  ingredients?: Ingredient[];
  steps?: string[];
};

/**
 * The 28 seed ideas, seven per mode. supabase/seed.sql is generated from the same JSON
 * (`npm run gen:seed`), so ids match on the phone and on the server.
 */
export const seedIdeas = seed as Idea[];

export const moods: { key: Mood; label: string }[] = [
  { key: 'comfy', label: 'Comfy' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'spicy', label: 'Spicy' },
];

export const costs: Cost[] = [1, 2, 3];
