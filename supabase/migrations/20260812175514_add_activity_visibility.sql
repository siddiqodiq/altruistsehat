alter table public.activities
  add column if not exists visibility text not null default 'internal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activities'::regclass
      and conname = 'activities_visibility_check'
  ) then
    alter table public.activities
      add constraint activities_visibility_check
      check (visibility in ('internal', 'public'));
  end if;
end
$$;

create index if not exists activities_public_visibility_starts_at_idx
  on public.activities (starts_at desc, created_at desc)
  where visibility = 'public';

revoke all on table public.activities from anon, authenticated;
revoke all on table public.activity_images from anon, authenticated;
revoke all on table public.activity_participants from anon, authenticated;

grant all privileges on table public.activities to service_role;
grant all privileges on table public.activity_images to service_role;
grant all privileges on table public.activity_participants to service_role;
