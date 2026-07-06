import { expect, test } from "@playwright/test";
import {
  DEFAULT_EXPORT_PHOTO_ADJUSTMENTS,
  clampExportPhotoAdjustment,
  compactCutoutBackdropStyle,
  compactExportAthleteCountForLayout,
  compactExportRowHeightPx,
  compactPhotoForegroundAdjustmentStyle,
  compactPhotoTreatmentForImage,
  compactPresetPreviewHeightPx,
  fullFramePhotoAdjustmentStyle,
  resolveAthletePhotoAdjustment,
} from "../../src/lib/leaderboard/photo-adjustments";
import type { RankedAthlete } from "../../src/lib/leaderboard/types";

const athlete: RankedAthlete = {
  id: "leaderboard-rakha",
  name: "Rakha Maulana",
  rank: 1,
  value: 20,
};

test("resolveAthletePhotoAdjustment prefers export overrides over athlete presets and defaults", () => {
  const resolved = resolveAthletePhotoAdjustment({
    athlete: {
      ...athlete,
      podiumPhotoAdjustments: {
        top5: { zoom: 1.25, x: 8, y: -5 },
      },
    },
    exportPhotoAdjustments: {
      top5: {
        "leaderboard-rakha": { zoom: 1.5, x: -6, y: 9 },
      },
    },
    layoutMode: "top5",
  });

  expect(resolved).toEqual({ zoom: 1.5, x: -6, y: 9 });
});

test("resolveAthletePhotoAdjustment falls back to athlete presets before global defaults", () => {
  const resolved = resolveAthletePhotoAdjustment({
    athlete: {
      ...athlete,
      podiumPhotoAdjustments: {
        top3: { zoom: 1.18, x: 4, y: -7 },
      },
    },
    exportPhotoAdjustments: {},
    layoutMode: "top3",
  });

  expect(resolved).toEqual({ zoom: 1.18, x: 4, y: -7 });
});

test("resolveAthletePhotoAdjustment falls back to layout defaults for athletes without presets", () => {
  expect(
    resolveAthletePhotoAdjustment({
      athlete,
      exportPhotoAdjustments: {},
      layoutMode: "podiumTop10",
    }),
  ).toEqual(DEFAULT_EXPORT_PHOTO_ADJUSTMENTS.podiumTop10);
});

test("clampExportPhotoAdjustment keeps persisted presets inside the export-safe range", () => {
  expect(clampExportPhotoAdjustment({ zoom: 9, x: -99, y: 99 })).toEqual({
    zoom: 2.2,
    x: -40,
    y: 40,
  });
});

test("compact export row heights match the story export grid for top one through five", () => {
  expect(compactExportRowHeightPx(5)).toBeCloseTo((1180 - 4 * 16) / 5);
  expect(compactExportRowHeightPx(4)).toBeCloseTo((1180 - 3 * 16) / 4);
  expect(compactExportRowHeightPx(3)).toBeCloseTo((1180 - 2 * 16) / 3);
  expect(compactExportRowHeightPx(2)).toBeCloseTo((1180 - 1 * 16) / 2);
  expect(compactExportRowHeightPx(1)).toBe(1180);
});

test("athlete preset preview heights stay proportional to compact export layouts", () => {
  const layouts = ["top5", "top4", "top3", "top2", "top1"] as const;
  const previewHeights = layouts.map((layout) => compactPresetPreviewHeightPx(layout));
  const exportHeights = layouts.map((layout) => compactExportRowHeightPx(compactExportAthleteCountForLayout(layout)));

  expect(previewHeights).toEqual([68, 86, 117, 178, 360]);
  expect(previewHeights).toEqual([...previewHeights].sort((left, right) => left - right));
  expect(previewHeights[4] / previewHeights[0]).toBeCloseTo(exportHeights[4] / exportHeights[0], 1);
});

test("full frame photo adjustment style lets compact photos fill the frame", () => {
  expect(fullFramePhotoAdjustmentStyle({ zoom: 1.15, x: 8, y: -4 })).toEqual({
    objectPosition: "58% 46%",
    transform: "scale(1.15)",
    transformOrigin: "center center",
  });
  expect(fullFramePhotoAdjustmentStyle({ zoom: 0.8, x: -80, y: 80 })).toEqual({
    objectPosition: "0% 100%",
    transform: "scale(1)",
    transformOrigin: "center center",
  });
});

test("compact foreground photo style allows flexible zoom-out over gradient backplates", () => {
  expect(compactPhotoForegroundAdjustmentStyle({ zoom: 0.8, x: -12, y: 6 })).toEqual({
    objectPosition: "50% 50%",
    transform: "translate(-12%, 6%) scale(0.8)",
    transformOrigin: "center center",
  });
});

test("compact photo treatment detects transparent cutout intent from local and uploaded image URLs", () => {
  expect(compactPhotoTreatmentForImage("data:image/png;base64,abc")).toBe("cutout");
  expect(compactPhotoTreatmentForImage("https://cdn.example.com/utha-podium-cutout.webp")).toBe("cutout");
  expect(compactPhotoTreatmentForImage("https://cdn.example.com/utha-podium.webp", true)).toBe("cutout");
  expect(compactPhotoTreatmentForImage("https://cdn.example.com/utha-podium.webp")).toBe("photo");
});

test("compact cutout podium backdrops use subtle medal accents by rank", () => {
  expect(compactCutoutBackdropStyle(1).background).toContain("255, 199, 44");
  expect(compactCutoutBackdropStyle(2).background).toContain("226, 232, 240");
  expect(compactCutoutBackdropStyle(3).background).toContain("196, 123, 53");
  expect(compactCutoutBackdropStyle(5).background).toContain("94, 122, 94");
});
