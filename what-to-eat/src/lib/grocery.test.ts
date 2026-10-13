import { describe, expect, it } from '@jest/globals';

import { seedIdeas } from '../data/ideas';
import { deliveryLinks } from './delivery';
import {
  addRecipe,
  clearChecked,
  groupByRecipe,
  hasRecipe,
  listToText,
  removeRecipe,
  toggleItem,
} from './grocery';

const pasta = seedIdeas.find((i) => i.name === 'Creamy tomato pasta')!;
const noodles = seedIdeas.find((i) => i.name === 'Spicy peanut noodles')!;

describe('recipes in the seed', () => {
  it('gives every Cook it idea ingredients and steps, and no other mode', () => {
    for (const idea of seedIdeas) {
      const isCook = idea.mode === 'cook';
      expect((idea.ingredients?.length ?? 0) > 0).toBe(isCook);
      expect((idea.steps?.length ?? 0) > 0).toBe(isCook);
    }
  });
});

describe('grocery list', () => {
  it('adds a recipe once, even if added twice', () => {
    const once = addRecipe([], pasta);
    expect(once).toHaveLength(pasta.ingredients!.length);
    expect(addRecipe(once, pasta)).toEqual(once);
    expect(hasRecipe(once, pasta.id)).toBe(true);
    expect(hasRecipe(once, noodles.id)).toBe(false);
  });

  it('keeps checked items checked when the recipe is added again', () => {
    const list = addRecipe([], pasta);
    const checked = toggleItem(list, list[0].id);
    expect(addRecipe(checked, pasta)[0].checked).toBe(true);
  });

  it('checks, clears checked, and removes a recipe', () => {
    let list = addRecipe(addRecipe([], pasta), noodles);
    list = toggleItem(list, list[0].id);
    list = toggleItem(list, list[1].id);
    expect(list.filter((i) => i.checked)).toHaveLength(2);
    expect(clearChecked(list)).toHaveLength(list.length - 2);
    expect(removeRecipe(list, pasta.id).every((i) => i.recipeId === noodles.id)).toBe(true);
  });

  it('leaves out the amount when there is none', () => {
    const fajitas = seedIdeas.find((i) => i.name === 'Sheet-pan fajitas')!;
    expect(listToText(addRecipe([], fajitas))).toContain('\n- sour cream, to serve');
  });

  it('groups by recipe in the order added', () => {
    const groups = groupByRecipe(addRecipe(addRecipe([], noodles), pasta));
    expect(groups.map((g) => g.recipeName)).toEqual([
      'Spicy peanut noodles',
      'Creamy tomato pasta',
    ]);
  });

  it('shares what is left to buy', () => {
    let list = addRecipe([], noodles);
    list = toggleItem(list, list[0].id);
    const text = listToText(list);
    expect(text.startsWith('Grocery list\n\nSpicy peanut noodles\n- 1/3 cup peanut butter')).toBe(
      true
    );
    expect(text).not.toContain(list[0].name);
    expect(listToText(list.map((i) => ({ ...i, checked: true })))).toBe('Grocery list: all done!');
  });
});

describe('deliveryLinks', () => {
  it('searches each delivery app for the dish', () => {
    expect(deliveryLinks(' Pad thai ').map((l) => l.url)).toEqual([
      'https://www.doordash.com/search/store/Pad%20thai/',
      'https://www.ubereats.com/search?q=Pad%20thai',
      'https://www.grubhub.com/search?queryText=Pad%20thai',
    ]);
    expect(deliveryLinks('Mac & cheese')[1].url).toBe(
      'https://www.ubereats.com/search?q=Mac%20%26%20cheese'
    );
  });
});
