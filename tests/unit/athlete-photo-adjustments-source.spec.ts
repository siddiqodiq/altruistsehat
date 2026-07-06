import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { STORY_EXPORT_LAYOUT_MODES } from "../../src/lib/leaderboard/photo-adjustments";

function source(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

test("athlete database schema and mapper preserve persisted podium photo adjustments", () => {
  const migrationSource = source("supabase/migrations/20260630100000_add_athlete_podium_photo_adjustments.sql");
  const sportMigrationSource = source("supabase/migrations/20260701080000_add_athlete_sport_podium_photo_urls.sql");
  const serverSource = source("src/lib/supabase/server.ts");

  expect(migrationSource).toContain("podium_photo_adjustments jsonb");
  expect(migrationSource).toContain("default '{}'::jsonb");
  expect(sportMigrationSource).toContain("sport_podium_photo_urls jsonb");
  expect(sportMigrationSource).toContain("default '{}'::jsonb");
  expect(serverSource).toContain("podium_photo_adjustments");
  expect(serverSource).toContain("sport_podium_photo_urls");
  expect(serverSource).toContain("podiumPhotoAdjustments");
  expect(serverSource).toContain("sportPodiumPhotoUrls");
});

test("athlete API routes accept and return podium photo adjustments", () => {
  const apiSource = source("src/lib/athletes/api.ts");
  const createRoute = source("src/app/api/athletes/route.ts");
  const updateRoute = source("src/app/api/athletes/[id]/route.ts");
  const lookupRoute = source("src/app/api/athletes/lookup/route.ts");

  expect(apiSource).toContain("updateAthletePhotoAdjustments");
  expect(apiSource).toContain("podiumPhotoAdjustments: AthletePodiumPhotoAdjustments");
  expect(createRoute).toContain("PodiumPhotoAdjustmentsSchema");
  expect(createRoute).toContain("SportPodiumPhotoUrlsSchema");
  expect(createRoute).toContain("podiumPhotoAdjustments");
  expect(createRoute).toContain("sportPodiumPhotoUrls");
  expect(createRoute).toContain("podium_photo_adjustments");
  expect(createRoute).toContain("sport_podium_photo_urls");
  expect(updateRoute).toContain("podiumPhotoAdjustments");
  expect(updateRoute).toContain("sportPodiumPhotoUrls");
  expect(updateRoute).toContain("podium_photo_adjustments");
  expect(updateRoute).toContain("sport_podium_photo_urls");
  expect(lookupRoute).toContain("athleteSelectColumns");
});

test("athlete photo payloads can explicitly clear stored photo URLs", () => {
  const apiSource = source("src/lib/athletes/api.ts");
  const appSource = source("src/components/athletes/AthleteDatabaseApp.tsx");
  const createRoute = source("src/app/api/athletes/route.ts");
  const updateRoute = source("src/app/api/athletes/[id]/route.ts");

  expect(apiSource).toContain("profilePhotoUrl?: string | null");
  expect(apiSource).toContain("podiumPhotoUrl?: string | null");
  expect(appSource).toContain("profilePhotoUrl: form.profilePhotoUrl.trim() || null");
  expect(appSource).toContain("podiumPhotoUrl: form.podiumPhotoUrl.trim() || null");
  expect(createRoute).toContain("z.string().url().nullable().optional()");
  expect(updateRoute).toContain("z.string().url().nullable().optional()");
});

test("athlete sport photo saves fail loudly when the Supabase sport column is missing", () => {
  const createRoute = source("src/app/api/athletes/route.ts");
  const updateRoute = source("src/app/api/athletes/[id]/route.ts");
  const serverSource = source("src/lib/supabase/server.ts");

  expect(serverSource).toContain("ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE");
  expect(createRoute).toContain("ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE");
  expect(updateRoute).toContain("ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE");
  expect(createRoute).toContain("hasSportPodiumPhotoUrls");
  expect(updateRoute).toContain("hasSportPodiumPhotoUrls");
  expect(createRoute).toContain("{ status: 409 }");
  expect(updateRoute).toContain("{ status: 409 }");
});

test("athlete admin exposes sport-specific podium photo slots without fallback copy", () => {
  const appSource = source("src/components/athletes/AthleteDatabaseApp.tsx");

  expect(appSource).toContain("Sport Podium Photos");
  expect(appSource).toContain("SPORT_PODIUM_PHOTO_OPTIONS");
  expect(appSource).toContain("sportPodiumPhotoUrls");
  expect(appSource).toContain("sportPodiumPreviewUrls");
  expect(appSource).toContain("pendingSportPodiumFiles");
  expect(appSource).toContain("handleSportPodiumImageSelection");
  expect(appSource).toContain("handleClearSportPodiumPhoto");
  expect(appSource).not.toContain("Default podium photo is used when a sport slot is empty.");
  expect(appSource).not.toContain("Fallback");
});

test("athlete admin exposes persistent podium presets for every story layout", () => {
  const appSource = source("src/components/athletes/AthleteDatabaseApp.tsx");

  expect(appSource).toContain("Podium Presets");
  expect(appSource).toContain("podiumPhotoAdjustments");
  expect(appSource).toContain("STORY_EXPORT_LAYOUT_MODES");
  expect(STORY_EXPORT_LAYOUT_MODES).toEqual(["podiumTop10", "top5", "top4", "top3", "top2", "top1"]);
  expect(appSource).toContain("Reset All");
});

test("athlete podium preset previews reflect compact export row height differences", () => {
  const appSource = source("src/components/athletes/AthleteDatabaseApp.tsx");

  expect(appSource).toContain("compactPresetPreviewHeightPx");
  expect(appSource).toContain("compactExportAthleteCountForLayout");
  expect(appSource).toContain("compactPhotoForegroundAdjustmentStyle");
  expect(appSource).toContain("compactCutoutBackdropStyle");
  expect(appSource).toContain("medal-backplate-foreground");
  expect(appSource).toContain("data-fit-strategy");
  expect(appSource).toContain('data-image-layer="compact-photo-foreground"');
  expect(appSource).toContain("podiumPreviewHasTransparency");
  expect(appSource).toContain("data-export-row-height-preview");
  expect(appSource).toContain("compactZoomMin");
  expect(appSource).toContain("isCompactExportLayoutMode(layoutMode) ? compactZoomMin : 1");
  expect(appSource).not.toContain("blur-xl");
  expect(appSource).not.toContain("compactPhotoBackgroundAdjustmentStyle");
  expect(appSource).not.toContain('data-fit-strategy="dual-layer-background-fill"');
  expect(appSource).not.toContain('data-image-layer="compact-photo-background"');
  expect(appSource).not.toContain('data-image-layer="portrait-safe-foreground"');
  expect(appSource).not.toContain('data-crop="portrait-safe-foreground"');
  expect(appSource).not.toContain("left-0 z-[1]");
  expect(appSource).not.toContain("w-[56%]");
  expect(appSource).not.toContain("w-[70%]");
  expect(appSource).not.toContain("COMPACT_PRESET_PREVIEW_HEIGHTS");
  expect(appSource).not.toContain('layoutMode === "podiumTop10" ? "aspect-[5/8] max-w-[190px]" : "aspect-[16/7] w-full"');
});
