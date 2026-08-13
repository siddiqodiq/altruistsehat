create extension if not exists pgcrypto;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  activity_type text not null,
  sport_type text not null check (char_length(trim(sport_type)) > 0),
  description text not null check (char_length(trim(description)) > 0),
  location text not null check (char_length(trim(location)) > 0),
  starts_at timestamptz not null,
  documentation_url text check (documentation_url is null or documentation_url ~* '^https?://'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activities'::regclass
      and conname = 'activities_activity_type_check'
  ) then
    alter table public.activities
      add constraint activities_activity_type_check
      check (activity_type in (
        'Olahraga Bareng',
        'Sparing Olahraga',
        'Partnership Event',
        'Brand Collaboration',
        'Lainnya'
      ));
  end if;
end $$;

create table if not exists public.activity_images (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  image_url text not null check (image_url ~* '^https?://'),
  sort_order integer not null default 0 check (sort_order >= 0),
  alt_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_participants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (activity_id, athlete_id)
);

create index if not exists activities_starts_at_idx
  on public.activities (starts_at desc);

create index if not exists activities_created_by_idx
  on public.activities (created_by);

create index if not exists activity_images_activity_id_sort_order_idx
  on public.activity_images (activity_id, sort_order asc);

create index if not exists activity_participants_activity_id_idx
  on public.activity_participants (activity_id);

create index if not exists activity_participants_athlete_id_idx
  on public.activity_participants (athlete_id);

create index if not exists activity_participants_assigned_by_idx
  on public.activity_participants (assigned_by);

create or replace function public.set_activities_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_activities_updated_at on public.activities;

create trigger set_activities_updated_at
before update on public.activities
for each row
execute function public.set_activities_updated_at();

alter table public.activities enable row level security;
alter table public.activity_images enable row level security;
alter table public.activity_participants enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-images',
  'activity-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read activity images" on storage.objects;

create policy "Public read activity images"
on storage.objects
for select
to public
using (bucket_id = 'activity-images');

grant usage on schema public to service_role;
grant all privileges on table public.activities to service_role;
grant all privileges on table public.activity_images to service_role;
grant all privileges on table public.activity_participants to service_role;
