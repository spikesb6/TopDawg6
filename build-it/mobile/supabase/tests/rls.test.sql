-- Checks Row Level Security on saved builds and photos, and the version rule. Everything runs in
-- a transaction that is rolled back. Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

-- Signed in as A.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

insert into public.builds (user_id, data) values ('00000000-0000-0000-0000-00000000000a', '{"done": {"f1": true}}');
insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-00000000000a/ph1.jpg');

do $$ begin
  assert (select count(*) from public.builds) = 1, 'A sees their build';
  assert (select version from public.builds) = 1, 'a new build starts at version 1';
  begin
    insert into public.builds (user_id, data) values ('00000000-0000-0000-0000-00000000000b', '{}');
    raise exception 'A created a build for B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-00000000000b/x.jpg');
    raise exception 'A put a photo in B''s folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Saving: the version must go up by exactly one.
update public.builds set data = '{"done": {"f1": true, "f2": true}}', version = 2;
do $$ begin
  assert (select version from public.builds) = 2, 'a save moves to version 2';
  begin
    update public.builds set data = '{}', version = 5;
    raise exception 'a save skipped versions';
  exception when check_violation then null;
  end;
end $$;

-- A phone that last saw version 1 saves nothing (another phone saved since).
update public.builds set data = '{}', version = 2 where version = 1;
do $$ begin
  assert (select data from public.builds) = '{"done": {"f1": true, "f2": true}}'::jsonb, 'a stale save changes nothing';
end $$;

-- Signed in as B: A's build and photos are invisible and untouchable.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

update public.builds set data = '{}', version = 3;
delete from storage.objects;

do $$ begin
  assert (select count(*) from public.builds) = 0, 'B cannot see A''s build';
  assert (select count(*) from storage.objects) = 0, 'B cannot see A''s photos';
end $$;

-- Back as the database owner: B's update and delete touched nothing of A's.
reset role;
do $$ begin
  assert (select version from public.builds where user_id = '00000000-0000-0000-0000-00000000000a') = 2, 'B did not change A''s build';
  assert (select count(*) from storage.objects) = 1, 'B did not delete A''s photo';
end $$;

-- Deleting an account deletes its build.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.builds) = 0, 'the build goes with the account';
end $$;

select 'rls tests passed' as result;
rollback;
