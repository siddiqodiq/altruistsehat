import { expect, test } from "@playwright/test";
import { LEADERBOARD_CATEGORIES } from "../../src/lib/leaderboard/categories";
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
