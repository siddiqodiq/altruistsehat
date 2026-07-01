alter table public.athletes
add column if not exists podium_photo_adjustments jsonb not null default '{}'::jsonb;
