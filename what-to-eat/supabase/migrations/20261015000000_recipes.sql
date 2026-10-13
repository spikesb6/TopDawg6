-- Phase 5: Cook it ideas carry a recipe.
-- ingredients: [{ "qty": "12 oz", "name": "penne" }, ...]
-- steps: ["Boil the penne...", ...]
alter table public.ideas
  add column ingredients jsonb,
  add column steps jsonb,
  add constraint ideas_ingredients_is_array
    check (ingredients is null or jsonb_typeof(ingredients) = 'array'),
  add constraint ideas_steps_is_array
    check (steps is null or jsonb_typeof(steps) = 'array');
