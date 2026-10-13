-- Checks Row Level Security and the profile trigger. Everything runs in a transaction that is
-- rolled back. Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"full_name": "Alex"}'),
  ('00000000-0000-0000-0000-00000000000b', '{}');

do $$ begin
  assert (select display_name from public.profiles
          where user_id = '00000000-0000-0000-0000-00000000000a') = 'Alex',
    'a profile is created at first sign-in';
end $$;

-- Signed in as A.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

insert into public.favorites (idea_id) values (1), (5);
insert into public.picks (idea_id, picked_at) values (2, now() - interval '2 days'), (3, now());

do $$ begin
  assert (select count(*) from public.ideas) = 28, 'signed-in users read all ideas';
  assert (select count(*) from public.favorites) = 2, 'A sees their favorites';
  assert (select count(*) from public.picks) = 2, 'A sees their picks';
  assert (select count(*) from public.profiles) = 1, 'A sees only their own profile';
end $$;

do $$ begin
  begin
    insert into public.favorites (user_id, idea_id)
    values ('00000000-0000-0000-0000-00000000000b', 3);
    raise exception 'A wrote a favorite for B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.picks (user_id, idea_id)
    values ('00000000-0000-0000-0000-00000000000b', 3);
    raise exception 'A wrote a pick for B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.ideas (mode, name, blurb, mood, cost) values ('cook', 'x', 'x', 'comfy', 1);
    raise exception 'A wrote to ideas';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Places: A can heart a place and lock one in; a pick is an idea or a place, never both.
insert into public.place_favorites (place_id, name, mode) values ('gp-1', 'Near Tacos', 'fast');
insert into public.picks (place_id, place_name, place_mode) values ('gp-1', 'Near Tacos', 'fast');

do $$ begin
  assert (select count(*) from public.place_favorites) = 1, 'A sees their place favorite';
  assert (select count(*) from public.picks) = 3, 'A sees idea and place picks';
  begin
    insert into public.picks (idea_id, place_id, place_name, place_mode)
    values (1, 'gp-2', 'x', 'fast');
    raise exception 'a pick had both an idea and a place';
  exception when check_violation then null;
  end;
  begin
    insert into public.picks (place_id) values ('gp-3');
    raise exception 'a place pick had no name';
  exception when check_violation then null;
  end;
  begin
    insert into public.place_favorites (user_id, place_id, name, mode)
    values ('00000000-0000-0000-0000-00000000000b', 'gp-4', 'x', 'dine');
    raise exception 'A wrote a place favorite for B';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.places_cache;
    raise exception 'a signed-in user read the places cache';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Signed in as B on another phone: sees none of A's data and cannot delete it.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

delete from public.favorites where idea_id = 1;

do $$ begin
  assert (select count(*) from public.favorites) = 0, 'B sees no favorites from A';
  assert (select count(*) from public.picks) = 0, 'B sees no picks from A';
  assert (select count(*) from public.place_favorites) = 0, 'B sees no place favorites from A';
end $$;

-- Back to A: still has both favorites, and can remove one.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

do $$ begin
  assert (select count(*) from public.favorites) = 2, 'B could not delete A''s favorites';
end $$;

delete from public.favorites where idea_id = 1;

do $$ begin
  assert (select count(*) from public.favorites) = 1, 'A can remove their own favorite';
end $$;

-- Guests (anon) can read ideas but nothing that belongs to a user.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

do $$ begin
  assert (select count(*) from public.ideas) = 28, 'guests read all ideas';
  begin
    perform 1 from public.favorites;
    raise exception 'guest read favorites';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.picks;
    raise exception 'guest read picks';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.place_favorites;
    raise exception 'guest read place favorites';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.places_cache;
    raise exception 'guest read the places cache';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'rls tests passed' as result;
rollback;
