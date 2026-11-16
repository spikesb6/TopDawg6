-- Build It accounts: one saved build per person, and a private folder of photos.

create table public.builds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  -- Goes up by one on every save, so a phone can tell another phone saved since it last looked.
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.builds enable row level security;

create policy "Read own build" on public.builds
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own build" on public.builds
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Save own build" on public.builds
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- No delete policy: the build goes when the account is deleted (on delete cascade).

-- Every save moves the version up by exactly one and stamps the time.
create function public.builds_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'version must go up by one (was %, got %)', old.version, new.version
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger builds_before_update before update on public.builds
  for each row execute function public.builds_before_update();

-- Photos: private bucket, each person reads and writes only their own folder (<user id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Add own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Replace own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
