alter table public.activities
  add column if not exists registration_enabled boolean not null default false,
  add column if not exists registration_closed boolean not null default false;

create table if not exists public.activity_guest_registrations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  guest_name text not null check (char_length(trim(guest_name)) > 0 and char_length(trim(guest_name)) <= 120),
  phone text not null check (char_length(trim(phone)) > 0 and char_length(trim(phone)) <= 32),
  normalized_phone text not null check (normalized_phone ~ '^[0-9]{8,16}$'),
  community text not null check (char_length(trim(community)) > 0 and char_length(trim(community)) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, normalized_phone)
);

create index if not exists activity_guest_registrations_activity_id_idx
  on public.activity_guest_registrations (activity_id, created_at desc);

drop trigger if exists set_activity_guest_registrations_updated_at on public.activity_guest_registrations;

create trigger set_activity_guest_registrations_updated_at
before update on public.activity_guest_registrations
for each row
execute function public.set_activities_updated_at();

alter table public.activity_guest_registrations enable row level security;

revoke all on table public.activity_guest_registrations from anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on table public.activity_guest_registrations to service_role;
