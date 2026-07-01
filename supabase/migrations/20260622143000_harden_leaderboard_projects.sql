alter table if exists public.leaderboard_projects enable row level security;

revoke all on table public.leaderboard_projects from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on table public.leaderboard_projects to service_role;

create or replace function public.set_leaderboard_projects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_leaderboard_projects_updated_at on public.leaderboard_projects;

create trigger set_leaderboard_projects_updated_at
before update on public.leaderboard_projects
for each row
execute function public.set_leaderboard_projects_updated_at();
