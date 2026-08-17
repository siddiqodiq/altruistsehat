import { expect, test } from "@playwright/test";
import { defaultSportMetricOptions } from "../../src/lib/leaderboard/categories";
import { buildSeasonMonthCalendar, buildSeasonWeekCalendar, deriveSeasonWeekRange } from "../../src/lib/leaderboard/templates";

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

test("buildSeasonMonthCalendar maps calendar days to Monday-Sunday leaderboard weeks", () => {
  const calendar = buildSeasonMonthCalendar("2026", "31", "2026-07-01");

  expect(calendar.monthLabel).toBe("July 2026");
  expect(calendar.days).toHaveLength(42);
  expect(calendar.days[0]).toMatchObject({ dateIso: "2026-06-29", inMonth: false, weekValue: "27" });
  expect(calendar.days.at(-1)).toMatchObject({ dateIso: "2026-08-09", inMonth: false, weekValue: "32" });

  expect(calendar.days.find((day) => day.dateIso === "2026-07-30")).toMatchObject({
    compactWeekRange: "27 Jul–2 Aug 2026",
    dayOfMonth: "30",
    inMonth: true,
    isActiveWeek: true,
    weekValue: "31",
  });

  expect(calendar.days.filter((day) => day.weekValue === "31").map((day) => day.dateIso)).toEqual([
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02",
  ]);
});

test("buildSeasonMonthCalendar exposes selectable Monday-Sunday week rows", () => {
  const calendar = buildSeasonMonthCalendar("2026", "31", "2026-07-01");

  expect(calendar.weekRows).toHaveLength(6);
  expect(calendar.weekRows[0].days.map((day) => day.dateIso)).toEqual([
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
  ]);
  expect(calendar.weekRows[4]).toMatchObject({
    compactWeekRange: "27 Jul–2 Aug 2026",
    isActiveWeek: true,
    weekValue: "31",
  });
  expect(calendar.weekRows[4].days.map((day) => day.dateIso)).toEqual([
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02",
  ]);
});

test("defaultSportMetricOptions exposes sport-first metric options for every leaderboard category", () => {
  expect(defaultSportMetricOptions().map((option) => `${option.sportLabel}:${option.metricLabel}`)).toEqual([
    "Running:Distance",
    "Running:Elevation Gain",
    "Cycling:Distance",
    "Swimming:Distance",
    "Weight Training:Time",
  ]);

  expect(defaultSportMetricOptions().find((option) => option.categoryId === "running")).toMatchObject({
    metricLabel: "Distance",
    templateId: "running_weekly_mileage",
  });

  expect(defaultSportMetricOptions().find((option) => option.categoryId === "running_elevation_gain")).toMatchObject({
    metricLabel: "Elevation Gain",
    templateId: "running_elevation_gain",
  });
});
