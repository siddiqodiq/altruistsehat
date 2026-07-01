alter table public.athletes
add column if not exists sport_podium_photo_urls jsonb not null default '{}'::jsonb;
