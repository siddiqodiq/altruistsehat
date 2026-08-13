alter table public.activities
  add column if not exists logo_has_white_outline boolean not null default false;
