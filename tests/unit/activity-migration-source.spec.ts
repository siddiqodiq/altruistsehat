import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const migration = path.join(process.cwd(), "supabase/migrations/20260810110000_create_activities.sql");

test("activity migration creates tables, constraints, RLS, and storage", () => {
  const sql = fs.readFileSync(migration, "utf8").toLowerCase();

  expect(sql).toContain("create table if not exists public.activities");
  expect(sql).toContain("create table if not exists public.activity_images");
  expect(sql).toContain("create table if not exists public.activity_participants");
  expect(sql).toContain("unique (activity_id, athlete_id)");
  expect(sql).toContain("alter table public.activities enable row level security");
  expect(sql).toContain("alter table public.activity_images enable row level security");
  expect(sql).toContain("alter table public.activity_participants enable row level security");
  expect(sql).toContain("activity-images");
  expect(sql).toContain("activity_type");
  expect(sql).toContain("sport_type");
});

const dynamicMigration = path.join(process.cwd(), "supabase/migrations/20260811063939_add_dynamic_activity_schedule_and_seed.sql");
function migrationWithSuffix(suffix: string) {
  const filename = fs.readdirSync(path.join(process.cwd(), "supabase/migrations")).find((item) => item.endsWith(suffix));
  if (!filename) {
    throw new Error(`Missing migration ending with ${suffix}`);
  }
  return path.join(process.cwd(), "supabase/migrations", filename);
}

test("dynamic activity migration adds schedule, cover, taxonomy, and seeds timeline data", () => {
  const sql = fs.readFileSync(dynamicMigration, "utf8").toLowerCase();

  expect(sql).toContain("schedule_mode");
  expect(sql).toContain("recurrence_interval");
  expect(sql).toContain("recurrence_weekday");
  expect(sql).toContain("recurrence_month_week");
  expect(sql).toContain("recurrence_time");
  expect(sql).toContain("is_cover");
  expect(sql).toContain("where is_cover");
  expect(sql).toContain("'sosial'");
  expect(sql).toContain("'workout'");
  expect(sql).toContain("'competition'");
  expect(sql).toContain("lintas teknologi solution day 8th edition");
  expect(sql).toContain("bogor run 2026");
  expect(sql).toContain("lari bareng");
  expect(sql).toContain("badminton");
  expect(sql).toContain("schedule_mode = 'single'");
  expect(sql).toContain("schedule_mode = 'coming_soon'");
  expect(sql).toContain("schedule_mode = 'flexible'");
});

test("activity logo migration adds an optional constrained logo URL on existing activities", () => {
  const sql = fs.readFileSync(migrationWithSuffix("_add_activity_logo_url.sql"), "utf8").toLowerCase();

  expect(sql).toContain("alter table public.activities");
  expect(sql).toContain("add column if not exists logo_url text");
  expect(sql).toContain("activities_logo_url_check");
  expect(sql).toContain("logo_url is null");
  expect(sql).toContain("logo_url ~* '^https?://'");
  expect(sql).not.toContain("create table");
});

test("activity logo outline migration adds an optional boolean display setting without policy churn", () => {
  const sql = fs.readFileSync(migrationWithSuffix("_add_activity_logo_white_outline.sql"), "utf8").toLowerCase();

  expect(sql).toContain("alter table public.activities");
  expect(sql).toContain("add column if not exists logo_has_white_outline boolean not null default false");
  expect(sql).not.toContain("create index");
  expect(sql).not.toContain("create policy");
  expect(sql).not.toContain("grant ");
  expect(sql).not.toContain("revoke ");
});

test("activity visibility migration defaults existing rows to internal and indexes public activities", () => {
  const sql = fs.readFileSync(migrationWithSuffix("_add_activity_visibility.sql"), "utf8").toLowerCase();

  expect(sql).toContain("alter table public.activities");
  expect(sql).toContain("add column if not exists visibility text not null default 'internal'");
  expect(sql).toContain("activities_visibility_check");
  expect(sql).toContain("visibility in ('internal', 'public')");
  expect(sql).toContain("create index if not exists activities_public_visibility_starts_at_idx");
  expect(sql).toContain("where visibility = 'public'");
  expect(sql).toContain("revoke all on table public.activities from anon, authenticated");
  expect(sql).toContain("revoke all on table public.activity_images from anon, authenticated");
  expect(sql).toContain("revoke all on table public.activity_participants from anon, authenticated");
  expect(sql).toContain("grant all privileges on table public.activities to service_role");
  expect(sql).not.toContain("grant select on table public.activities to anon");
});

test("activity registration migration stores guest registrations privately and indexes duplicate checks", () => {
  const sql = fs.readFileSync(migrationWithSuffix("_add_activity_registration.sql"), "utf8").toLowerCase();

  expect(sql).toContain("alter table public.activities");
  expect(sql).toContain("add column if not exists registration_enabled boolean not null default false");
  expect(sql).toContain("add column if not exists registration_closed boolean not null default false");
  expect(sql).toContain("create table if not exists public.activity_guest_registrations");
  expect(sql).toContain("activity_id uuid not null references public.activities(id) on delete cascade");
  expect(sql).toContain("guest_name text not null");
  expect(sql).toContain("phone text not null");
  expect(sql).toContain("normalized_phone text not null");
  expect(sql).toContain("community text not null");
  expect(sql).toContain("unique (activity_id, normalized_phone)");
  expect(sql).toContain("activity_guest_registrations_activity_id_idx");
  expect(sql).toContain("alter table public.activity_guest_registrations enable row level security");
  expect(sql).toContain("revoke all on table public.activity_guest_registrations from anon, authenticated");
  expect(sql).toContain("grant all privileges on table public.activity_guest_registrations to service_role");
  expect(sql).not.toContain("grant select on table public.activity_guest_registrations to anon");
});
