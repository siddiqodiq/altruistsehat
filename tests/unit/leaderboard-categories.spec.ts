import { expect, test } from "@playwright/test";
import {
  categoryForSpec,
  categoryForSportMetric,
  LEADERBOARD_CATEGORIES,
  leaderboardSportOptions,
  metricOptionsForSport,
  normalizeLeaderboardCategory,
} from "../../src/lib/leaderboard/categories";
import { LEADERBOARD_TEMPLATES } from "../../src/lib/leaderboard/templates";

test("leaderboard categories use Weight Training time instead of Multisport moving time", () => {
  expect(LEADERBOARD_CATEGORIES.map((category) => category.id)).toContain("weight_training");
  expect(LEADERBOARD_CATEGORIES.map((category) => category.id)).not.toContain("multisport");

  expect(LEADERBOARD_CATEGORIES.find((category) => category.id === "weight_training")).toMatchObject({
    label: "Weight Training",
    shortLabel: "Weight",
    sportType: "Weight Training",
    metric: "time_minutes",
    templateId: "weight_training_time",
  });
});

test("leaderboard templates use Weight Training time instead of Multisport moving time", () => {
  expect(LEADERBOARD_TEMPLATES.map((template) => template.id)).toContain("weight_training_time");
  expect(LEADERBOARD_TEMPLATES.map((template) => template.id)).not.toContain("multisport_moving_time");

  expect(LEADERBOARD_TEMPLATES.find((template) => template.id === "weight_training_time")).toMatchObject({
    label: "WEIGHT TRAINING – TIME",
    sportType: "Weight Training",
    metric: "time_minutes",
    leaderboardMetric: "TIME",
  });
});

test("running elevation gain is selectable as a metric without duplicating the Running sport", () => {
  expect(LEADERBOARD_CATEGORIES.find((category) => category.id === "running_elevation_gain")).toMatchObject({
    label: "Running",
    metric: "elevation_m",
    metricLabel: "Elevation Gain",
    shortLabel: "Run",
    sportType: "Running",
    templateId: "running_elevation_gain",
  });

  expect(normalizeLeaderboardCategory("running_elevation_gain")).toBe("running_elevation_gain");
  expect(categoryForSpec({ sportType: "Running", metric: "elevation_m" })).toBe("running_elevation_gain");
  expect(categoryForSportMetric("Running", "distance_km")).toBe("running");
  expect(categoryForSportMetric("Running", "elevation_m")).toBe("running_elevation_gain");

  expect(leaderboardSportOptions().map((option) => `${option.sportType}:${option.defaultCategoryId}`)).toEqual([
    "Running:running",
    "Riding:cycling",
    "Swimming:swimming",
    "Weight Training:weight_training",
  ]);

  expect(metricOptionsForSport("Running").map((option) => `${option.metricLabel}:${option.categoryId}:${option.templateId}`)).toEqual([
    "Distance:running:running_weekly_mileage",
    "Elevation Gain:running_elevation_gain:running_elevation_gain",
  ]);
});
