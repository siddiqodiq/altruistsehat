import { expect, test } from "@playwright/test";
import { defaultSportMetricOptions } from "../../src/lib/leaderboard/categories";
import { buildSeasonWeekCalendar, deriveSeasonWeekRange } from "../../src/lib/leaderboard/templates";

test("deriveSeasonWeekRange returns Monday to Sunday date ranges for admin calendar", () => {
  expect(deriveSeasonWeekRange("2026", "26")).toMatchObject({
    weekIndex: 26,
    weekValue: "26",
    weekNumber: "WEEK 26",
    startDateIso: "2026-06-22",
    endDateIso: "2026-06-28",
    dateRange: "22 Jun 2026 – 28 Jun 2026",
    compactDateRange: "22–28 Jun 2026",
  });
});

test("buildSeasonWeekCalendar groups selectable week ranges around the active month", () => {
  const calendar = buildSeasonWeekCalendar("2026", "26");

  expect(calendar.monthLabel).toBe("June 2026");
  expect(calendar.activeRange.compactDateRange).toBe("22–28 Jun 2026");
  expect(calendar.weeks.map((week) => week.compactDateRange)).toEqual([
    "1–7 Jun 2026",
    "8–14 Jun 2026",
    "15–21 Jun 2026",
    "22–28 Jun 2026",
    "29 Jun–5 Jul 2026",
  ]);
});

test("defaultSportMetricOptions exposes sport first while keeping one default metric per current category", () => {
  expect(defaultSportMetricOptions().map((option) => option.sportLabel)).toEqual([
    "Running",
    "Cycling",
    "Swimming",
    "Weight Training",
  ]);

  expect(defaultSportMetricOptions().find((option) => option.categoryId === "running")).toMatchObject({
    metricLabel: "Distance",
    templateId: "running_weekly_mileage",
  });
});
