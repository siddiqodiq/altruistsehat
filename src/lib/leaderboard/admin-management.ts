import type { LeaderboardProjectState } from "./project-state";
import { formatMetricValue, resolveMetricTotal } from "./metrics";
import { METRIC_LABELS, type AthleteEntry, type LeaderboardSpec } from "./types";

export const TEMPORARY_DEV_ADMIN_TOKEN = "admin123";
export const UNSAVED_ADMIN_CHANGES_STORAGE_KEY = "altruist-leaderboard-unsaved-admin:v1";

export type EditableAthleteField = "name" | "value";

export function isDevelopmentAdminToken(value: string): boolean {
  return value.trim() === TEMPORARY_DEV_ADMIN_TOKEN;
}

export function athleteCellKey(id: string, field: EditableAthleteField): string {
  return `${id}:${field}`;
}

function athleteMap(athletes: AthleteEntry[]): Map<string, AthleteEntry> {
  return new Map(athletes.map((athlete) => [athlete.id, athlete]));
}

function sameNumber(left: number | undefined, right: number | undefined): boolean {
  return (left ?? undefined) === (right ?? undefined);
}

export function changedAthleteCellKeys(current: LeaderboardSpec, baseline?: LeaderboardSpec): Set<string> {
  const changed = new Set<string>();
  const baselineAthletes = athleteMap(baseline?.athletes ?? []);

  current.athletes.forEach((athlete) => {
    const saved = baselineAthletes.get(athlete.id);
    if (!saved) {
      changed.add(athleteCellKey(athlete.id, "name"));
      changed.add(athleteCellKey(athlete.id, "value"));
      return;
    }

    if (athlete.name !== saved.name) {
      changed.add(athleteCellKey(athlete.id, "name"));
    }

    if (athlete.value !== saved.value) {
      changed.add(athleteCellKey(athlete.id, "value"));
    }
  });

  return changed;
}

export function countLeaderboardDraftChanges(current: LeaderboardProjectState, baseline?: LeaderboardProjectState): number {
  if (!baseline) {
    return 0;
  }

  let count = 0;
  const currentAthletes = athleteMap(current.spec.athletes);
  const baselineAthletes = athleteMap(baseline.spec.athletes);

  if (current.seasonYear !== baseline.seasonYear) count += 1;
  if (current.weekNumber !== baseline.weekNumber) count += 1;
  if (current.templateId !== baseline.templateId) count += 1;
  if (!sameNumber(current.spec.totalOverride, baseline.spec.totalOverride)) count += 1;

  current.spec.athletes.forEach((athlete) => {
    const saved = baselineAthletes.get(athlete.id);
    if (!saved) {
      const newRowChanges = Number(athlete.name.trim().length > 0) + Number(athlete.value !== 0);
      count += Math.max(1, newRowChanges);
      return;
    }

    if (athlete.name !== saved.name) count += 1;
    if (athlete.value !== saved.value) count += 1;
  });

  baseline.spec.athletes.forEach((athlete) => {
    if (!currentAthletes.has(athlete.id)) {
      count += 1;
    }
  });

  return count;
}

function compactWeekNumber(value: string): string {
  return value.replace(/^week\s*/i, "").trim() || value;
}

function compactMetricLabel(metricLabel: string): string {
  return metricLabel.replace(/^total\s+/i, "").trim();
}

export function getAdminLeaderboardContextSummary(project: LeaderboardProjectState) {
  return {
    season: project.seasonYear,
    week: compactWeekNumber(project.weekNumber),
    metric: compactMetricLabel(METRIC_LABELS[project.spec.metric]),
    total: `${formatMetricValue(resolveMetricTotal(project.spec.athletes, project.spec.totalOverride), project.spec.metric)} total`,
    athletes: `${project.spec.athletes.length} ${project.spec.athletes.length === 1 ? "athlete" : "athletes"}`,
  };
}

export function getDeleteWeekTarget(project: LeaderboardProjectState) {
  return {
    dateRange: project.spec.dateRange,
    seasonYear: project.seasonYear,
    templateId: project.templateId,
    weekNumber: project.weekNumber,
  };
}

function compactDateRange(dateRange: string): string | undefined {
  const normalized = dateRange.replace(/\s+(?:-|–|to|sampai)\s+/gi, "–").trim();
  const parts = normalized.split("–").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) {
    return normalized || undefined;
  }

  const start = parts[0];
  const end = parts[1];
  const startMatch = start.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const endMatch = end.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);

  if (startMatch && endMatch && startMatch[2] === endMatch[2] && startMatch[3] === endMatch[3]) {
    return `${startMatch[1]}–${endMatch[1]} ${endMatch[2]} ${endMatch[3]}`;
  }

  return `${start}–${end}`;
}

export function formatDeleteWeekSuccessMessage(dateRange?: string, weekNumber?: string): string {
  const period = dateRange ? compactDateRange(dateRange) : undefined;
  return `Data minggu ${period ?? `Week ${weekNumber ?? ""}`.trim()} berhasil dihapus`;
}
