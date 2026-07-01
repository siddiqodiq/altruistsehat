create extension if not exists pgcrypto;

create table if not exists public.leaderboard_week_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  season_year text not null,
  week_number text not null,
  week_index integer not null check (week_index > 0),
  template_id text not null,
  spec jsonb not null,
  total numeric not null check (total >= 0),
  athlete_count integer not null check (athlete_count >= 0),
  exported_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaderboard_week_snapshots_unique_week unique (client_id, season_year, week_number, template_id)
);

create index if not exists leaderboard_week_snapshots_client_exported_idx
  on public.leaderboard_week_snapshots (client_id, exported_at desc);

create index if not exists leaderboard_week_snapshots_previous_week_idx
  on public.leaderboard_week_snapshots (client_id, season_year, template_id, week_index desc);

alter table public.leaderboard_week_snapshots enable row level security;

revoke all on table public.leaderboard_week_snapshots from anon, authenticated;
grant select, insert, update on table public.leaderboard_week_snapshots to service_role;

create or replace function public.set_leaderboard_week_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_leaderboard_week_snapshots_updated_at on public.leaderboard_week_snapshots;

create trigger set_leaderboard_week_snapshots_updated_at
before update on public.leaderboard_week_snapshots
for each row
execute function public.set_leaderboard_week_snapshots_updated_at();
