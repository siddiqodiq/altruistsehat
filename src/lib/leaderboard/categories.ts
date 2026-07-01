import { GLOBAL_LEADERBOARD_CLIENT_ID } from "./constants";
import { getLeaderboardTemplate } from "./templates";
import type { LeaderboardTemplateId } from "./templates";
import type { LeaderboardWeekSnapshot } from "./week-snapshots";
import { METRIC_LABELS, type LeaderboardSpec, type MetricType, type SportType } from "./types";

export const LEADERBOARD_CATEGORIES = [
  {
    id: "running",
    label: "Running",
    shortLabel: "Run",
    templateId: "running_weekly_mileage",
    sportType: "Running",
    metric: "distance_km",
  },
  {
    id: "cycling",
    label: "Cycling",
    shortLabel: "Ride",
    templateId: "riding_weekly_distance",
    sportType: "Riding",
    metric: "cycling_distance_km",
  },
  {
    id: "swimming",
    label: "Swimming",
    shortLabel: "Swim",
    templateId: "swimming_distance",
    sportType: "Swimming",
    metric: "distance_km",
  },
  {
    id: "weight_training",
    label: "Weight Training",
    shortLabel: "Weight",
    templateId: "weight_training_time",
    sportType: "Weight Training",
    metric: "time_minutes",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  shortLabel: string;
  templateId: string;
  sportType: SportType;
  metric: MetricType;
}>;

export type LeaderboardCategoryId = (typeof LEADERBOARD_CATEGORIES)[number]["id"];

export const DEFAULT_LEADERBOARD_CATEGORY: LeaderboardCategoryId = "running";

export function normalizeLeaderboardCategory(value: unknown): LeaderboardCategoryId {
  const text = String(value ?? "").trim().toLowerCase();
  return LEADERBOARD_CATEGORIES.find((category) => category.id === text)?.id ?? DEFAULT_LEADERBOARD_CATEGORY;
}

export function categoryForTemplateId(templateId: string): LeaderboardCategoryId {
  const normalizedTemplate = getLeaderboardTemplate(templateId).id;
  return LEADERBOARD_CATEGORIES.find((category) => category.templateId === normalizedTemplate)?.id ?? DEFAULT_LEADERBOARD_CATEGORY;
}

export function categoryConfigForId(categoryId: LeaderboardCategoryId) {
  return LEADERBOARD_CATEGORIES.find((category) => category.id === categoryId) ?? LEADERBOARD_CATEGORIES[0];
}

export function categoryForSpec(spec: Pick<LeaderboardSpec, "metric" | "sportType">): LeaderboardCategoryId | undefined {
  if (spec.sportType === "Weight Training" && spec.metric === "time_minutes") {
    return "weight_training";
  }

  if (spec.sportType === "Swimming" && spec.metric === "distance_km") {
    return "swimming";
  }

  if ((spec.sportType === "Riding" || spec.sportType === "Cycling") && spec.metric === "cycling_distance_km") {
    return "cycling";
  }

  if (spec.sportType === "Running" && spec.metric === "distance_km") {
    return "running";
  }

  return undefined;
}

export function isSnapshotInCategory(snapshot: LeaderboardWeekSnapshot, categoryId: LeaderboardCategoryId): boolean {
  const category = LEADERBOARD_CATEGORIES.find((item) => item.id === categoryId) ?? LEADERBOARD_CATEGORIES[0];
  return (
    snapshot.templateId === category.templateId ||
    (snapshot.spec.sportType === category.sportType && snapshot.spec.metric === category.metric) ||
    categoryForSpec(snapshot.spec) === categoryId
  );
}

export function filterSnapshotsByCategory(
  snapshots: LeaderboardWeekSnapshot[],
  categoryId: LeaderboardCategoryId,
): LeaderboardWeekSnapshot[] {
  return snapshots.filter((snapshot) => isSnapshotInCategory(snapshot, categoryId));
}

export function templateIdForCategory(categoryId: LeaderboardCategoryId) {
  return categoryConfigForId(categoryId).templateId as LeaderboardTemplateId;
}

export function projectIdForCategory(categoryId: LeaderboardCategoryId) {
  return `${GLOBAL_LEADERBOARD_CLIENT_ID}-${categoryConfigForId(categoryId).id}`;
}

export interface DefaultSportMetricOption {
  categoryId: LeaderboardCategoryId;
  sportLabel: string;
  metricLabel: string;
  templateId: LeaderboardTemplateId;
}

export function defaultSportMetricOptions(): DefaultSportMetricOption[] {
  return LEADERBOARD_CATEGORIES.map((category) => ({
    categoryId: category.id,
    sportLabel: category.label,
    metricLabel: METRIC_LABELS[category.metric].replace(/^total\s+/i, "").trim(),
    templateId: category.templateId as LeaderboardTemplateId,
  }));
}
