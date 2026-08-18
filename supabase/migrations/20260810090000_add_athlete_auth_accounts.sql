alter table public.athletes
  add column if not exists username text,
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.athletes'::regclass
      and conname = 'athletes_username_unique'
  ) then
    alter table public.athletes
      add constraint athletes_username_unique unique (username);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.athletes'::regclass
      and conname = 'athletes_auth_user_id_unique'
  ) then
    alter table public.athletes
      add constraint athletes_auth_user_id_unique unique (auth_user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.athletes'::regclass
      and conname = 'athletes_auth_user_id_fkey'
  ) then
    alter table public.athletes
      add constraint athletes_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;
