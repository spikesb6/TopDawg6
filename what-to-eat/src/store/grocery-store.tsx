import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Idea } from '@/data/ideas';
import { addRecipe, clearChecked, removeRecipe, toggleItem, type GroceryItem } from '@/lib/grocery';

// The grocery list is kept on this phone only.
const STORAGE_KEY = 'what-to-eat/grocery';

type GroceryStore = {
  items: GroceryItem[];
  addRecipe: (idea: Idea) => void;
  toggle: (id: string) => void;
  clearChecked: () => void;
  removeRecipe: (recipeId: number) => void;
};

const Ctx = createContext<GroceryStore | null>(null);

export function GroceryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<GroceryItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setItems(JSON.parse(raw) as GroceryItem[]))
      .catch(() => {});
  }, []);

  const update = (next: (prev: GroceryItem[]) => GroceryItem[]) =>
    setItems((prev) => {
      const value = next(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => {});
      return value;
    });

  const store: GroceryStore = {
    items,
    addRecipe: (idea) => update((prev) => addRecipe(prev, idea)),
    toggle: (id) => update((prev) => toggleItem(prev, id)),
    clearChecked: () => update(clearChecked),
    removeRecipe: (recipeId) => update((prev) => removeRecipe(prev, recipeId)),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useGrocery() {
  const store = useContext(Ctx);
  if (!store) throw new Error('useGrocery must be used inside GroceryProvider');
  return store;
}
