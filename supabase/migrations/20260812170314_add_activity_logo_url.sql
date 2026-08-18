alter table public.activities
  add column if not exists logo_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activities'::regclass
      and conname = 'activities_logo_url_check'
  ) then
    alter table public.activities
      add constraint activities_logo_url_check
      check (logo_url is null or logo_url ~* '^https?://');
  end if;
end $$;
