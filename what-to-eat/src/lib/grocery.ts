import type { Idea } from '@/data/ideas';

export type GroceryItem = {
  /** Stable per recipe and ingredient, so adding a recipe twice doesn't double it. */
  id: string;
  name: string;
  qty: string;
  recipeId: number;
  recipeName: string;
  checked: boolean;
};

const itemId = (recipeId: number, name: string) => `${recipeId}:${name.trim().toLowerCase()}`;

export function hasRecipe(list: GroceryItem[], recipeId: number) {
  return list.some((i) => i.recipeId === recipeId);
}

/** Adds a recipe's ingredients. Items already on the list stay as they are. */
export function addRecipe(list: GroceryItem[], idea: Idea): GroceryItem[] {
  const existing = new Set(list.map((i) => i.id));
  const added = (idea.ingredients ?? [])
    .map((ing) => ({
      id: itemId(idea.id, ing.name),
      name: ing.name,
      qty: ing.qty,
      recipeId: idea.id,
      recipeName: idea.name,
      checked: false,
    }))
    .filter((i) => !existing.has(i.id) && existing.add(i.id));
  return [...list, ...added];
}

export function toggleItem(list: GroceryItem[], id: string): GroceryItem[] {
  return list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
}

export function clearChecked(list: GroceryItem[]): GroceryItem[] {
  return list.filter((i) => !i.checked);
}

export function removeRecipe(list: GroceryItem[], recipeId: number): GroceryItem[] {
  return list.filter((i) => i.recipeId !== recipeId);
}

/** Items grouped under their recipe, in the order recipes were added. */
export function groupByRecipe(list: GroceryItem[]) {
  const groups = new Map<number, { recipeId: number; recipeName: string; items: GroceryItem[] }>();
  for (const item of list) {
    const group = groups.get(item.recipeId) ?? {
      recipeId: item.recipeId,
      recipeName: item.recipeName,
      items: [],
    };
    group.items.push(item);
    groups.set(item.recipeId, group);
  }
  return [...groups.values()];
}

/** Plain text for sharing: what's still left to buy, by recipe. */
export function listToText(list: GroceryItem[]): string {
  const groups = groupByRecipe(list.filter((i) => !i.checked));
  if (groups.length === 0) return 'Grocery list: all done!';
  return [
    'Grocery list',
    ...groups.map(
      (g) =>
        `\n${g.recipeName}\n${g.items.map((i) => `- ${[i.qty, i.name].filter(Boolean).join(' ')}`).join('\n')}`
    ),
  ].join('\n');
}
