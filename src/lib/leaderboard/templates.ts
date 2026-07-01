import type { LeaderboardSpec, MetricType, SportType, ThemeId } from "./types";

export type LeaderboardTemplateId =
  | "running_weekly_mileage"
  | "running_elevation_gain"
  | "riding_weekly_distance"
  | "riding_elevation_gain"
  | "swimming_distance"
  | "weight_training_time"
  | "walking_distance";

export interface LeaderboardTemplate {
  id: LeaderboardTemplateId;
  label: string;
  sportType: SportType;
  metric: MetricType;
  leaderboardMetric: string;
}

export const DEFAULT_LEADERBOARD_TEMPLATE_ID: LeaderboardTemplateId = "running_weekly_mileage";

export const LEADERBOARD_TEMPLATES: LeaderboardTemplate[] = [
  {
    id: "running_weekly_mileage",
    label: "RUNNING – WEEKLY MILEAGE",
    sportType: "Running",
    metric: "distance_km",
    leaderboardMetric: "WEEKLY MILEAGE",
  },
  {
    id: "running_elevation_gain",
    label: "RUNNING – ELEVATION GAIN",
    sportType: "Running",
    metric: "elevation_m",
    leaderboardMetric: "ELEVATION GAIN",
  },
  {
    id: "riding_weekly_distance",
    label: "RIDING – WEEKLY DISTANCE",
    sportType: "Riding",
    metric: "cycling_distance_km",
    leaderboardMetric: "WEEKLY DISTANCE",
  },
  {
    id: "riding_elevation_gain",
    label: "RIDING – ELEVATION GAIN",
    sportType: "Riding",
    metric: "elevation_m",
    leaderboardMetric: "ELEVATION GAIN",
  },
  {
    id: "swimming_distance",
    label: "SWIMMING – DISTANCE",
    sportType: "Swimming",
    metric: "distance_km",
    leaderboardMetric: "DISTANCE",
  },
  {
    id: "weight_training_time",
    label: "WEIGHT TRAINING – TIME",
    sportType: "Weight Training",
    metric: "time_minutes",
    leaderboardMetric: "TIME",
  },
  {
    id: "walking_distance",
    label: "WALKING – DISTANCE",
    sportType: "Walking",
    metric: "distance_km",
    leaderboardMetric: "DISTANCE",
  },
];

const monthNames = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export const DEFAULT_SEASON_YEAR = "2026";
export const DEFAULT_WEEK_NUMBER = "1";
export const FIXED_FOOTER_QUOTE = "CHASING\nBETTER\nEVERY DAY";

const dayMs = 86400000;

function normalizedPositiveInteger(input: string, fallback: number): number {
  const parsed = Number.parseInt(input.match(/\d+/)?.[0] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs);
}

function firstSundayOfYear(yearNumber: number): Date {
  const firstDay = new Date(Date.UTC(yearNumber, 0, 1));
  const daysUntilSunday = (7 - firstDay.getUTCDay()) % 7;
  return addDays(firstDay, daysUntilSunday);
}

function day(date: Date): string {
  return String(date.getUTCDate());
}

function month(date: Date): string {
  const value = monthNames[date.getUTCMonth()].slice(0, 3);
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function monthTitle(date: Date): string {
  const value = monthNames[date.getUTCMonth()];
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function year(date: Date): string {
  return String(date.getUTCFullYear());
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateFromIso(value: string): Date {
  const [yearValue, monthValue, dayValue] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!yearValue || !monthValue || !dayValue) {
    return new Date(Date.UTC(Number(DEFAULT_SEASON_YEAR), 0, 1));
  }

  return new Date(Date.UTC(yearValue, monthValue - 1, dayValue));
}

function compactDateRange(start: Date, end: Date): string {
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${day(start)}–${day(end)} ${month(end)} ${year(end)}`;
  }

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${day(start)} ${month(start)}–${day(end)} ${month(end)} ${year(end)}`;
  }

  return `${day(start)} ${month(start)} ${year(start)}–${day(end)} ${month(end)} ${year(end)}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return addDays(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)), -1);
}

export interface SeasonWeekRange {
  weekIndex: number;
  weekValue: string;
  weekNumber: string;
  startDateIso: string;
  endDateIso: string;
  dateRange: string;
  compactDateRange: string;
}

export interface SeasonWeekCalendar {
  monthLabel: string;
  monthStartIso: string;
  activeRange: SeasonWeekRange;
  weeks: SeasonWeekRange[];
}

export function deriveSeasonWeekRange(seasonYear: string, weekInput: string): SeasonWeekRange {
  const yearNumber = normalizedPositiveInteger(seasonYear, Number(DEFAULT_SEASON_YEAR));
  const weekIndex = normalizedPositiveInteger(weekInput, Number(DEFAULT_WEEK_NUMBER));
  const firstSunday = firstSundayOfYear(yearNumber);
  const weekOneStart = addDays(firstSunday, -6);
  const start = addDays(weekOneStart, (weekIndex - 1) * 7);
  const end = addDays(start, 6);

  return {
    weekIndex,
    weekValue: String(weekIndex),
    weekNumber: `WEEK ${weekIndex}`,
    startDateIso: isoDate(start),
    endDateIso: isoDate(end),
    dateRange: `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`,
    compactDateRange: compactDateRange(start, end),
  };
}

export function buildSeasonWeekCalendar(
  seasonYear: string,
  activeWeekInput: string,
  monthAnchorIso?: string,
): SeasonWeekCalendar {
  const activeRange = deriveSeasonWeekRange(seasonYear, activeWeekInput);
  const monthAnchor = monthAnchorIso ? dateFromIso(monthAnchorIso) : dateFromIso(activeRange.startDateIso);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);

  const weeks = Array.from({ length: 53 }, (_, index) => deriveSeasonWeekRange(seasonYear, String(index + 1))).filter(
    (range) => dateFromIso(range.startDateIso) <= monthEnd && dateFromIso(range.endDateIso) >= monthStart,
  );

  return {
    monthLabel: `${monthTitle(monthAnchor)} ${monthAnchor.getUTCFullYear()}`,
    monthStartIso: isoDate(monthStart),
    activeRange,
    weeks,
  };
}

export function shiftMonthIso(monthStartIso: string, offset: number): string {
  const monthStart = startOfMonth(dateFromIso(monthStartIso));
  return isoDate(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + offset, 1)));
}

export function deriveSeasonWeekFields(
  seasonYear: string,
  weekInput: string,
): Pick<LeaderboardSpec, "weekNumber" | "dateRange"> {
  const range = deriveSeasonWeekRange(seasonYear, weekInput);
  return {
    weekNumber: range.weekNumber,
    dateRange: range.dateRange,
  };
}

export function getLeaderboardTemplate(templateId: string): LeaderboardTemplate {
  return LEADERBOARD_TEMPLATES.find((template) => template.id === templateId) ?? LEADERBOARD_TEMPLATES[0];
}

export function leaderboardTemplateToSpecPatch(
  templateId: string,
): Pick<LeaderboardSpec, "sportType" | "metric" | "leaderboardTitle" | "leaderboardMetric" | "theme"> {
  const template = getLeaderboardTemplate(templateId);

  return {
    sportType: template.sportType,
    metric: template.metric,
    leaderboardTitle: "TOP 10",
    leaderboardMetric: template.leaderboardMetric,
    theme: "altruist_dark" satisfies ThemeId,
  };
}

export function derivePreviousWeekTotal(trendValues: number[]): number | undefined {
  if (trendValues.length < 2) {
    return undefined;
  }

  return trendValues[trendValues.length - 2];
}

export function deriveCurrentTrendTotal(trendValues: number[], fallback: number): number {
  if (!trendValues.length) {
    return fallback;
  }

  return trendValues[trendValues.length - 1];
}
