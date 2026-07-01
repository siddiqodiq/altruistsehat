create extension if not exists pgcrypto;

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  profile_photo_url text,
  podium_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athletes enable row level security;

create or replace function public.set_athletes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_athletes_updated_at on public.athletes;

create trigger set_athletes_updated_at
before update on public.athletes
for each row
execute function public.set_athletes_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('athlete-profile', 'athlete-profile', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('athlete-podium', 'athlete-podium', true, 8388608, array['image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read athlete images" on storage.objects;
drop policy if exists "Authenticated upload athlete images" on storage.objects;
drop policy if exists "Authenticated update athlete images" on storage.objects;

create policy "Public read athlete images"
on storage.objects
for select
to public
using (bucket_id in ('athlete-profile', 'athlete-podium'));

create policy "Authenticated upload athlete images"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('athlete-profile', 'athlete-podium'));

create policy "Authenticated update athlete images"
on storage.objects
for update
to authenticated
using (bucket_id in ('athlete-profile', 'athlete-podium'))
with check (bucket_id in ('athlete-profile', 'athlete-podium'));
