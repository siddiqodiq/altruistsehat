create or replace function public.set_athletes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "Service role manages athletes" on public.athletes;

create policy "Service role manages athletes"
on public.athletes
for all
to service_role
using (true)
with check (true);
