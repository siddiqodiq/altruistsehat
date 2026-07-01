import { expect, test } from "@playwright/test";
import { requireLeaderboardAdmin } from "../../src/lib/leaderboard/admin-auth";
import {
  countLeaderboardDraftChanges,
  formatDeleteWeekSuccessMessage,
  getAdminLeaderboardContextSummary,
  getDeleteWeekTarget,
} from "../../src/lib/leaderboard/admin-management";
import type { LeaderboardProjectState } from "../../src/lib/leaderboard/project-state";
import { LeaderboardProjectStateSchema } from "../../src/lib/leaderboard/project-state";

function requestWithToken(token: string): Request {
  return new Request("http://localhost/api/leaderboard/week-snapshots", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

test("temporary local admin auth accepts the hardcoded development token", () => {
  expect(requireLeaderboardAdmin(requestWithToken("admin123"))).toBeUndefined();
});

test("temporary local admin auth rejects invalid development tokens", async () => {
  const response = requireLeaderboardAdmin(requestWithToken("not-admin123"));

  expect(response).toBeInstanceOf(Response);
  expect(response?.status).toBe(401);
  await expect(response?.json()).resolves.toMatchObject({
    success: false,
    message: "Invalid admin token.",
  });
});

test("formatDeleteWeekSuccessMessage compacts same-month date ranges for toasts", () => {
  expect(formatDeleteWeekSuccessMessage("22 Jun 2026 – 28 Jun 2026")).toBe(
    "Data minggu 22–28 Jun 2026 berhasil dihapus",
  );
});

test("formatDeleteWeekSuccessMessage falls back to week number when no date range exists", () => {
  expect(formatDeleteWeekSuccessMessage(undefined, "24")).toBe("Data minggu Week 24 berhasil dihapus");
});

test("countLeaderboardDraftChanges counts edited cells for newly added athletes", () => {
  const baseline = projectWithAthletes([]);
  const current = projectWithAthletes([{ id: "athlete-a", name: "Atlet A", value: 45 }]);

  expect(countLeaderboardDraftChanges(current, baseline)).toBe(2);
});

test("getAdminLeaderboardContextSummary formats compact context bar values", () => {
  const project = projectWithAthletes([
    { id: "athlete-a", name: "Atlet A", value: 120.25 },
    { id: "athlete-b", name: "Atlet B", value: 80.75 },
  ]);

  expect(getAdminLeaderboardContextSummary(project)).toEqual({
    season: "2026",
    week: "24",
    metric: "Distance",
    total: "201,00 km total",
    athletes: "2 athletes",
  });
});

test("getDeleteWeekTarget scopes deletes to the active season week and metric template", () => {
  const project = projectWithAthletes([{ id: "athlete-a", name: "Atlet A", value: 120.25 }]);

  expect(getDeleteWeekTarget(project)).toEqual({
    dateRange: "22 Jun 2026 – 28 Jun 2026",
    seasonYear: "2026",
    templateId: "running_weekly_mileage",
    weekNumber: "24",
  });
});

test("leaderboard project schema accepts empty athlete arrays for deleted weeks", () => {
  const project = projectWithAthletes([]);

  expect(LeaderboardProjectStateSchema.safeParse(project).success).toBe(true);
});

function projectWithAthletes(athletes: Array<{ id: string; name: string; value: number }>): LeaderboardProjectState {
  return {
    projectId: "altruist-sehat-running",
    status: "Draft",
    seasonYear: "2026",
    weekNumber: "24",
    templateId: "running_weekly_mileage",
    updatedAt: "2026-06-23T00:00:00.000Z",
    exportHistory: [],
    spec: {
      communityName: "ALTRUIST SEHAT",
      sportType: "Running",
      weekNumber: "24",
      dateRange: "22 Jun 2026 – 28 Jun 2026",
      leaderboardTitle: "Weekly race report",
      leaderboardMetric: "Total Mileage",
      metric: "distance_km",
      trendValues: [],
      quote: "Chasing better every day",
      theme: "altruist_dark",
      athletes,
    },
  };
}
