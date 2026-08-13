alter table public.activities
  alter column starts_at drop not null;

alter table public.activities
  add column if not exists schedule_mode text not null default 'single',
  add column if not exists schedule_label text,
  add column if not exists recurrence_interval smallint,
  add column if not exists recurrence_weekday smallint,
  add column if not exists recurrence_month_week smallint,
  add column if not exists recurrence_time time;

alter table public.activities
  drop constraint if exists activities_activity_type_check,
  drop constraint if exists activities_sport_type_check,
  drop constraint if exists activities_schedule_mode_check,
  drop constraint if exists activities_schedule_single_starts_at_check,
  drop constraint if exists activities_recurrence_interval_check,
  drop constraint if exists activities_recurrence_weekday_check,
  drop constraint if exists activities_recurrence_month_week_check;

alter table public.activities
  add constraint activities_activity_type_check
  check (activity_type in (
    'Sosial',
    'Workout',
    'Competition',
    'Olahraga Bareng',
    'Sparing Olahraga',
    'Partnership Event',
    'Brand Collaboration',
    'Lainnya'
  )),
  add constraint activities_sport_type_check
  check (sport_type in (
    'Run',
    'Weight Training',
    'Ride',
    'Swim',
    'Trail Run',
    'TrailRun',
    'Walk',
    'GravelRide',
    'MountainBikeRide',
    'WeightTraining',
    'Workout',
    'Yoga',
    'Hike',
    'Rowing',
    'Basket',
    'Badminton',
    'Sepakbola',
    'Tenis',
    'Padel'
  )),
  add constraint activities_schedule_mode_check
  check (schedule_mode in ('single', 'weekly', 'monthly', 'flexible', 'coming_soon')),
  add constraint activities_schedule_single_starts_at_check
  check (schedule_mode <> 'single' or starts_at is not null),
  add constraint activities_recurrence_interval_check
  check (recurrence_interval is null or recurrence_interval between 1 and 4),
  add constraint activities_recurrence_weekday_check
  check (recurrence_weekday is null or recurrence_weekday between 0 and 6),
  add constraint activities_recurrence_month_week_check
  check (recurrence_month_week is null or recurrence_month_week between 1 and 4);

alter table public.activity_images
  add column if not exists is_cover boolean not null default false;

with ranked_images as (
  select
    id,
    activity_id,
    row_number() over (partition by activity_id order by sort_order asc, created_at asc, id asc) as image_rank
  from public.activity_images
),
activities_without_cover as (
  select distinct ranked_images.activity_id
  from ranked_images
  where not exists (
    select 1
    from public.activity_images existing_cover
    where existing_cover.activity_id = ranked_images.activity_id
      and existing_cover.is_cover
  )
)
update public.activity_images image
set is_cover = true
from ranked_images
join activities_without_cover using (activity_id)
where image.id = ranked_images.id
  and ranked_images.image_rank = 1;

create unique index if not exists activity_images_one_cover_per_activity_idx
  on public.activity_images (activity_id)
  where is_cover;

-- Seed includes rows where schedule_mode = 'single', schedule_mode = 'coming_soon', and schedule_mode = 'flexible'.
with seed (
  name,
  activity_type,
  sport_type,
  description,
  location,
  starts_at,
  schedule_mode,
  schedule_label,
  recurrence_interval,
  recurrence_weekday,
  recurrence_month_week,
  recurrence_time
) as (
  values
    ('LINTAS TEKNOLOGI SOLUTION DAY 8th Edition', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2025-11-29 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('AMR Runs', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2025-11-30 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Topscore Fun Run 7K', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2025-12-03 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Jekate Running Series 2025', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2025-12-04 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Universal BPR Fun Run 5k', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2026-01-10 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('RS Puri Cinere Fun Run 5K', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2026-01-25 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Enervon Nusantara Run 5K', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2026-02-08 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Kolaboran 2026', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2026-02-14 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Rope&Run Challenge', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2026-04-19 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Tring Golden Run', 'Competition', 'Run', 'Event komunitas dari timeline beranda lama.', 'TBD', '2026-04-26 06:00:00+07'::timestamptz, 'single', null, null, null, null, null),
    ('Bogor Run 2026', 'Competition', 'Run', 'Coming soon dari timeline beranda lama.', 'TBD', null, 'coming_soon', 'Coming Soon', null, null, null, null),
    ('ASNRun 2026', 'Competition', 'Run', 'Coming soon dari timeline beranda lama.', 'TBD', null, 'coming_soon', 'Coming Soon', null, null, null, null),
    ('Alfamart Run 2026', 'Competition', 'Run', 'Coming soon dari timeline beranda lama.', 'TBD', null, 'coming_soon', 'Coming Soon', null, null, null, null),
    ('Lari bareng', 'Workout', 'Run', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Setiap minggu', null, null, null, null),
    ('Cisadon Trail', 'Workout', 'Trail Run', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Setiap Bulan', null, null, null, null),
    ('Renang', 'Workout', 'Swim', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Rutin', null, null, null, null),
    ('Basket', 'Workout', 'Basket', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Rutin', null, null, null, null),
    ('Badminton', 'Workout', 'Badminton', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Rutin', null, null, null, null),
    ('Sepakbola', 'Workout', 'Sepakbola', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Rutin', null, null, null, null),
    ('Tenis', 'Workout', 'Tenis', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Jarang', null, null, null, null),
    ('Padel', 'Workout', 'Padel', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Jarang', null, null, null, null),
    ('Yoga', 'Workout', 'Yoga', 'Kegiatan rutin dari timeline beranda lama.', 'TBD', null, 'flexible', 'Opsional', null, null, null, null)
)
insert into public.activities (
  name,
  activity_type,
  sport_type,
  description,
  location,
  starts_at,
  schedule_mode,
  schedule_label,
  recurrence_interval,
  recurrence_weekday,
  recurrence_month_week,
  recurrence_time
)
select
  seed.name,
  seed.activity_type,
  seed.sport_type,
  seed.description,
  seed.location,
  seed.starts_at,
  seed.schedule_mode,
  seed.schedule_label,
  seed.recurrence_interval::smallint,
  seed.recurrence_weekday::smallint,
  seed.recurrence_month_week::smallint,
  seed.recurrence_time::time
from seed
where not exists (
  select 1
  from public.activities existing
  where existing.name = seed.name
    and existing.sport_type = seed.sport_type
);
