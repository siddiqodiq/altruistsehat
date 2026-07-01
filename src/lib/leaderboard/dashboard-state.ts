import { GLOBAL_LEADERBOARD_CLIENT_ID } from "./constants";
import {
  LEADERBOARD_CATEGORIES,
  projectIdForCategory,
  templateIdForCategory,
  type LeaderboardCategoryId,
} from "./categories";
import { resolveMetricTotal } from "./metrics";
import {
  createInitialProjectState,
  migrateStoredProjectState,
  type LeaderboardProjectState,
} from "./project-state";
import { buildLeaderboardRows } from "./ranking";
import { DEFAULT_SPEC } from "./schema";
import {
  DEFAULT_LEADERBOARD_TEMPLATE_ID,
  DEFAULT_SEASON_YEAR,
  DEFAULT_WEEK_NUMBER,
  FIXED_FOOTER_QUOTE,
  LEADERBOARD_TEMPLATES,
  derivePreviousWeekTotal,
  deriveSeasonWeekFields,
  leaderboardTemplateToSpecPatch,
  type LeaderboardTemplateId,
} from "./templates";
import { upsertWeekSnapshot, type LeaderboardWeekSnapshot } from "./week-snapshots";
import type { LeaderboardSpec } from "./types";

export const ADMIN_TOKEN_STORAGE_KEY = "altruist-leaderboard-admin-token:v1";
export const STORY_FORMAT = "story" as const;

export function normalizeTemplateId(value: unknown): LeaderboardTemplateId {
  const text = String(value ?? "");
  return (LEADERBOARD_TEMPLATES.find((template) => template.id === text)?.id ?? DEFAULT_LEADERBOARD_TEMPLATE_ID) as LeaderboardTemplateId;
}

export function deriveDashboardSpec(
  spec: LeaderboardSpec,
  seasonYear: string,
  weekNumber: string,
  templateId: LeaderboardTemplateId,
): LeaderboardSpec {
  const trendValues = spec.trendValues.filter((value) => Number.isFinite(value));

  return {
    ...spec,
    ...deriveSeasonWeekFields(seasonYear, weekNumber),
    ...leaderboardTemplateToSpecPatch(templateId),
    communityName: "ALTRUIST SEHAT",
    logoDataUrl: undefined,
    previousWeekTotal: derivePreviousWeekTotal(trendValues),
    quote: FIXED_FOOTER_QUOTE,
    trendValues,
  };
}

export const DEFAULT_DRAFT = createInitialProjectState({
  spec: deriveDashboardSpec(DEFAULT_SPEC, DEFAULT_SEASON_YEAR, DEFAULT_WEEK_NUMBER, DEFAULT_LEADERBOARD_TEMPLATE_ID),
  seasonYear: DEFAULT_SEASON_YEAR,
  weekNumber: DEFAULT_WEEK_NUMBER,
  templateId: DEFAULT_LEADERBOARD_TEMPLATE_ID,
});

export function createCategoryDraft(
  categoryId: LeaderboardCategoryId,
  overrides: Partial<LeaderboardProjectState> = {},
): LeaderboardProjectState {
  const templateId = normalizeTemplateId(templateIdForCategory(categoryId));
  const seasonYear = overrides.seasonYear ?? DEFAULT_SEASON_YEAR;
  const weekNumber = overrides.weekNumber ?? DEFAULT_WEEK_NUMBER;
  const sourceSpec = overrides.spec ?? { ...DEFAULT_SPEC, athletes: [] };
  const draft = createInitialProjectState({
    spec: deriveDashboardSpec(sourceSpec, seasonYear, weekNumber, templateId),
    seasonYear,
    weekNumber,
    templateId,
  });

  return {
    ...draft,
    projectId: projectIdForCategory(categoryId),
    status: overrides.status ?? draft.status,
    exportHistory: overrides.exportHistory ?? draft.exportHistory,
    updatedAt: overrides.updatedAt ?? draft.updatedAt,
  };
}

export function createInitialCategoryDrafts(): Record<LeaderboardCategoryId, LeaderboardProjectState> {
  return Object.fromEntries(
    LEADERBOARD_CATEGORIES.map((category) => [category.id, createCategoryDraft(category.id)]),
  ) as Record<LeaderboardCategoryId, LeaderboardProjectState>;
}

export function normalizeCategoryProjectState(
  raw: unknown,
  categoryId: LeaderboardCategoryId,
): LeaderboardProjectState | undefined {
  const migrated = migrateStoredProjectState(raw);
  return migrated ? createCategoryDraft(categoryId, migrated) : undefined;
}

export function currentSnapshotFromDraft(draft: LeaderboardProjectState): LeaderboardWeekSnapshot {
  const ranked = buildLeaderboardRows(draft.spec.athletes, 10);

  return {
    clientId: GLOBAL_LEADERBOARD_CLIENT_ID,
    seasonYear: draft.seasonYear,
    weekNumber: draft.weekNumber,
    templateId: draft.templateId,
    spec: draft.spec,
    total: resolveMetricTotal(draft.spec.athletes, draft.spec.totalOverride),
    athleteCount: ranked.length,
    exportedAt: draft.updatedAt,
  };
}

export function buildTrendValues(snapshots: LeaderboardWeekSnapshot[], draft: LeaderboardProjectState): number[] {
  const merged = upsertWeekSnapshot(snapshots, currentSnapshotFromDraft(draft));
  return merged
    .slice()
    .sort((left, right) => new Date(left.exportedAt).getTime() - new Date(right.exportedAt).getTime())
    .map((snapshot) => snapshot.total)
    .filter((value) => Number.isFinite(value));
}

export function snapshotKey(snapshot: LeaderboardWeekSnapshot): string {
  return `${snapshot.seasonYear}:${snapshot.weekNumber}:${snapshot.templateId}`;
}

export function displayWeekLabel(snapshot: LeaderboardWeekSnapshot): string {
  const match = String(snapshot.weekNumber).match(/(?:week\s*)?(\d+)/i);
  return `Week ${match?.[1] ?? snapshot.weekNumber}`;
}
