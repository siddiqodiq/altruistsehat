import { expect, test } from "@playwright/test";
import {
  EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY,
  localExportPhotoAdjustmentsForAthlete,
  specWithLocalExportPhotoAdjustments,
  writeLocalExportPhotoAdjustment,
} from "../../src/lib/leaderboard/export-photo-autosave";
import type { LeaderboardSpec } from "../../src/lib/leaderboard/types";

function memoryStorage(initial?: Record<string, string>) {
  const store = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

test("writeLocalExportPhotoAdjustment persists the latest adjustment by database athlete id", () => {
  const storage = memoryStorage();

  writeLocalExportPhotoAdjustment({
    adjustment: { zoom: 1.4, x: 12, y: -8 },
    athlete: { athleteId: "database-rakha", id: "leaderboard-rakha", name: "Rakha Maulana" },
    layoutMode: "top5",
    storage,
  });

  expect(JSON.parse(storage.getItem(EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY) ?? "{}")).toEqual({
    "database-rakha": {
      top5: { zoom: 1.4, x: 12, y: -8 },
    },
  });
});

test("localExportPhotoAdjustmentsForAthlete falls back to normalized name when no database id exists", () => {
  const storage = memoryStorage({
    [EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY]: JSON.stringify({
      "rakha maulana": {
        top3: { zoom: 1.2, x: 5, y: -4 },
      },
    }),
  });

  expect(
    localExportPhotoAdjustmentsForAthlete({
      athlete: { id: "leaderboard-rakha", name: "Rakha Maulana" },
      storage,
    }),
  ).toEqual({
    top3: { zoom: 1.2, x: 5, y: -4 },
  });
});

test("specWithLocalExportPhotoAdjustments uses local fallback without overriding database presets", () => {
  const storage = memoryStorage({
    [EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY]: JSON.stringify({
      "database-rakha": {
        top5: { zoom: 1.4, x: 12, y: -8 },
        top3: { zoom: 1.1, x: 2, y: 3 },
      },
    }),
  });
  const spec: LeaderboardSpec = {
    athletes: [
      {
        athleteId: "database-rakha",
        id: "leaderboard-rakha",
        name: "Rakha Maulana",
        podiumPhotoAdjustments: {
          top5: { zoom: 1.8, x: -5, y: 6 },
        },
        value: 10,
      },
    ],
    communityName: "Altruist Sehat",
    dateRange: "1-7 JUL 2026",
    leaderboardMetric: "Weekly Mileage",
    leaderboardTitle: "TOP 5",
    metric: "distance_km",
    quote: "CHASING BETTER EVERY DAY",
    sportType: "Running",
    theme: "altruist_dark",
    trendValues: [],
    weekNumber: "WEEK 27",
  };

  const hydrated = specWithLocalExportPhotoAdjustments(spec, storage);

  expect(hydrated.athletes[0].podiumPhotoAdjustments).toEqual({
    top3: { zoom: 1.1, x: 2, y: 3 },
    top5: { zoom: 1.8, x: -5, y: 6 },
  });
});
