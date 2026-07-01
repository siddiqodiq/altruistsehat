create table if not exists public.leaderboard_projects (
  project_id text primary key,
  client_id text not null,
  status text not null default 'Draft' check (status in ('Draft', 'Exporting', 'Exported', 'Archived')),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_projects_client_updated_idx
  on public.leaderboard_projects (client_id, updated_at desc);

alter table public.leaderboard_projects enable row level security;
