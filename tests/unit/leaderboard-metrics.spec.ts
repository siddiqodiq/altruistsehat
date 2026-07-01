import { expect, test } from "@playwright/test";
import { calculateWeeklyComparison, formatMetricDisplayParts, formatMetricValue } from "../../src/lib/leaderboard/metrics";

test("formatMetricValue renders Indonesian two-decimal values with the active metric unit", () => {
  expect(formatMetricValue(20.9, "distance_km")).toBe("20,90 km");
  expect(formatMetricValue(17.4, "cycling_distance_km")).toBe("17,40 km");
  expect(formatMetricValue(11, "distance_km")).toBe("11,00 km");
  expect(formatMetricValue(4.7, "distance_km")).toBe("4,70 km");
  expect(formatMetricValue(2.5, "distance_km")).toBe("2,50 km");
});

test("formatMetricValue renders time minutes as compact Indonesian duration", () => {
  expect(formatMetricValue(550, "time_minutes")).toBe("9 jam 10 menit");
  expect(formatMetricValue(61, "time_minutes")).toBe("1 jam 1 menit");
  expect(formatMetricValue(60, "time_minutes")).toBe("1 jam");
  expect(formatMetricValue(50, "time_minutes")).toBe("50 menit");
  expect(formatMetricValue(0, "time_minutes")).toBe("0 menit");
});

test("formatMetricDisplayParts splits story metric values into primary and accent text", () => {
  expect(formatMetricDisplayParts(39, "distance_km")).toEqual({ primary: "39,00", accent: "KM" });
  expect(formatMetricDisplayParts(550, "time_minutes")).toEqual({ primary: "9 jam", accent: "10 menit" });
  expect(formatMetricDisplayParts(60, "time_minutes")).toEqual({ primary: "1 jam", accent: "" });
  expect(formatMetricDisplayParts(50, "time_minutes")).toEqual({ primary: "50 menit", accent: "" });
});

test("formatMetricValue is safe for empty and invalid metric values", () => {
  expect(formatMetricValue(null, "distance_km")).toBe("0,00 km");
  expect(formatMetricValue(null, "time_minutes")).toBe("0 menit");
  expect(formatMetricValue(undefined, "time_minutes")).toBe("0 menit");
  expect(formatMetricValue(Number.NaN, "distance_km")).toBe("0,00 km");
});

test("formatMetricValue supports compact decimals when explicitly configured", () => {
  expect(formatMetricValue(10, "distance_km", { minimumFractionDigits: 0, maximumFractionDigits: 2 })).toBe("10 km");
  expect(formatMetricValue(10.4, "distance_km", { minimumFractionDigits: 0, maximumFractionDigits: 2 })).toBe("10,4 km");
  expect(formatMetricValue(10, "distance_km", { minimumFractionDigits: 0, maximumFractionDigits: 1 })).toBe("10 km");
});

test("calculateWeeklyComparison does not force fixed two decimal places", () => {
  expect(calculateWeeklyComparison(10, 1)).toBe("+900%");
  expect(calculateWeeklyComparison(110, 100)).toBe("+10%");
  expect(calculateWeeklyComparison(11, 10)).toBe("+10%");
  expect(calculateWeeklyComparison(10.55, 10)).toBe("+6%");
  expect(calculateWeeklyComparison(21, 20)).toBe("+5%");
});
