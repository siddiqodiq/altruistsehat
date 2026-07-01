import { z } from "zod";
import { buildLeaderboardRows } from "./ranking";
import { LeaderboardSpecSchema } from "./schema";
import { updateProjectDraft, type LeaderboardProjectState } from "./project-state";
import { getLeaderboardTemplate, type LeaderboardTemplateId } from "./templates";
import type { AthleteEntry } from "./types";

export const LeaderboardWeekSnapshotSchema = z.object({
  id: z.string().min(1).optional(),
  clientId: z.string().trim().min(8).max(128),
  seasonYear: z.string().trim().min(1),
  weekNumber: z.string().trim().min(1),
  templateId: z.string().min(1).transform((value) => getLeaderboardTemplate(value).id),
  spec: LeaderboardSpecSchema,
  total: z.number().finite().nonnegative(),
  athleteCount: z.number().int().nonnegative(),
  exportedAt: z.string().min(1),
  createdAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
});

export type LeaderboardWeekSnapshot = z.infer<typeof LeaderboardWeekSnapshotSchema>;

export function weekIndexFromWeekNumber(value: string): number {
  const text = String(value ?? "");
  const match = text.match(/(?:week\s*)?(\d+)/i);
  const parsed = Number.parseInt(match?.[1] ?? text, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function snapshotWeekSortValue(snapshot: Pick<LeaderboardWeekSnapshot, "seasonYear" | "weekNumber">): number {
  const season = Number.parseInt(snapshot.seasonYear, 10);
  const seasonValue = Number.isFinite(season) ? season : 0;
  return seasonValue * 100 + weekIndexFromWeekNumber(snapshot.weekNumber);
}

export function compareSnapshotsByWeekAsc(left: LeaderboardWeekSnapshot, right: LeaderboardWeekSnapshot): number {
  const byWeek = snapshotWeekSortValue(left) - snapshotWeekSortValue(right);
  if (byWeek !== 0) {
    return byWeek;
  }

  return new Date(left.exportedAt).getTime() - new Date(right.exportedAt).getTime();
}

export function compareSnapshotsByWeekDesc(left: LeaderboardWeekSnapshot, right: LeaderboardWeekSnapshot): number {
  return compareSnapshotsByWeekAsc(right, left);
}

export function nextWeekInput(value: string): string {
  return String(weekIndexFromWeekNumber(value) + 1);
}

export function snapshotKey(snapshot: Pick<LeaderboardWeekSnapshot, "clientId" | "seasonYear" | "weekNumber" | "templateId">): string {
  return [snapshot.clientId, snapshot.seasonYear, snapshot.weekNumber, snapshot.templateId].join(":");
}

export function upsertWeekSnapshot(
  snapshots: LeaderboardWeekSnapshot[],
  snapshot: LeaderboardWeekSnapshot,
): LeaderboardWeekSnapshot[] {
  return [snapshot, ...snapshots.filter((item) => snapshotKey(item) !== snapshotKey(snapshot))].sort(compareSnapshotsByWeekDesc);
}

export function findPreviousWeekSnapshot(
  snapshots: LeaderboardWeekSnapshot[],
  input: Pick<LeaderboardProjectState, "seasonYear" | "weekNumber" | "templateId">,
): LeaderboardWeekSnapshot | undefined {
  const previousWeekIndex = weekIndexFromWeekNumber(input.weekNumber) - 1;
  if (previousWeekIndex < 1) {
    return undefined;
  }

  return snapshots
    .filter(
      (snapshot) =>
        snapshot.seasonYear === input.seasonYear &&
        snapshot.templateId === input.templateId &&
        weekIndexFromWeekNumber(snapshot.weekNumber) === previousWeekIndex,
    )
    .sort((left, right) => new Date(right.exportedAt).getTime() - new Date(left.exportedAt).getTime())[0];
}

export function topTenRosterFromSnapshot(snapshot: LeaderboardWeekSnapshot): AthleteEntry[] {
  return buildLeaderboardRows(snapshot.spec.athletes, 10).map((rankedAthlete) => {
    const { rank: _rank, ...athlete } = rankedAthlete;
    void _rank;
    return athlete;
  });
}

export function nextTrendValuesFromSnapshot(snapshot: LeaderboardWeekSnapshot): number[] {
  const trendValues = snapshot.spec.trendValues.filter((value) => Number.isFinite(value));
  const lastValue = trendValues[trendValues.length - 1];
  if (lastValue !== undefined && Math.abs(lastValue - snapshot.total) < 0.000001) {
    return trendValues;
  }

  return [...trendValues, snapshot.total];
}

export function createNextWeekProjectState(
  current: LeaderboardProjectState,
  snapshot: LeaderboardWeekSnapshot,
): LeaderboardProjectState {
  return updateProjectDraft(current, {
    status: "Draft",
    seasonYear: snapshot.seasonYear,
    weekNumber: nextWeekInput(snapshot.weekNumber),
    templateId: snapshot.templateId as LeaderboardTemplateId,
    spec: {
      ...snapshot.spec,
      athletes: topTenRosterFromSnapshot(snapshot).map((athlete) => ({ ...athlete, value: 0 })),
      previousWeekTotal: snapshot.total,
      trendValues: nextTrendValuesFromSnapshot(snapshot),
    },
  });
}
