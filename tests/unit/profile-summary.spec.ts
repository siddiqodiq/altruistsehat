import { expect, test } from "@playwright/test";
import {
  buildAthleteProfileSummary,
  normalizeProfilePhotoKind,
  validateProfilePasswordInput,
} from "../../src/lib/profile/summary";
import type { LeaderboardWeekSnapshot } from "../../src/lib/leaderboard/week-snapshots";

function snapshot({
  metric = "distance_km",
  sportType,
  templateId,
  values,
  weekNumber,
}: {
  metric?: "distance_km" | "time_minutes" | "activities_count";
  sportType: string;
  templateId: string;
  values: Array<{ athleteId?: string; name: string; normalizedName?: string; value: number }>;
  weekNumber: string;
}): LeaderboardWeekSnapshot {
  return {
    athleteCount: values.length,
    clientId: "altruist-sehat",
    exportedAt: `2026-07-${weekNumber.padStart(2, "0")}T00:00:00.000Z`,
    seasonYear: "2026",
    spec: {
      athletes: values.map((athlete, index) => ({
        id: `entry-${weekNumber}-${index}`,
        ...athlete,
      })),
      communityName: "Altruist Sehat",
      dateRange: "Jul 2026",
      leaderboardMetric: "Distance",
      leaderboardTitle: sportType,
      metric,
      quote: "",
      sportType,
      theme: "minimal_white",
      trendValues: [],
      weekNumber,
    },
    templateId,
    total: values.reduce((sum, athlete) => sum + athlete.value, 0),
    weekNumber,
  } as LeaderboardWeekSnapshot;
}

test("buildAthleteProfileSummary totals all leaderboard snapshots by sport and metric", () => {
  const summary = buildAthleteProfileSummary({
    activitySports: ["Run", "Swim"],
    athlete: {
      id: "athlete-1",
      name: "Marutha Wira Yuda",
      normalizedName: "marutha wira yuda",
    },
    snapshots: [
      snapshot({
        sportType: "Running",
        templateId: "running_weekly_mileage",
        values: [
          { athleteId: "athlete-1", name: "Marutha Wira Yuda", value: 12.5 },
          { name: "Other", value: 99 },
        ],
        weekNumber: "1",
      }),
      snapshot({
        sportType: "Running",
        templateId: "running_weekly_mileage",
        values: [{ name: "Marutha Wira Yuda", normalizedName: "marutha wira yuda", value: 7.5 }],
        weekNumber: "2",
      }),
      snapshot({
        sportType: "Cycling",
        templateId: "cycling_weekly_distance",
        values: [{ athleteId: "athlete-1", name: "Marutha Wira Yuda", value: 40 }],
        weekNumber: "3",
      }),
      snapshot({
        metric: "time_minutes",
        sportType: "Weight Training",
        templateId: "gym_weekly_time",
        values: [{ athleteId: "athlete-1", name: "Marutha Wira Yuda", value: 90 }],
        weekNumber: "4",
      }),
    ],
  });

  expect(summary.mileageBySport).toEqual([
    expect.objectContaining({ metric: "distance_km", snapshotCount: 2, sport: "Running", total: 20 }),
    expect.objectContaining({ metric: "distance_km", snapshotCount: 1, sport: "Cycling", total: 40 }),
    expect.objectContaining({ metric: "time_minutes", snapshotCount: 1, sport: "Weight Training", total: 90 }),
  ]);
  expect(summary.sports).toEqual(["Cycling", "Run", "Running", "Swim", "Weight Training"]);
});

test("validateProfilePasswordInput requires current password and a strong enough replacement", () => {
  expect(validateProfilePasswordInput({ currentPassword: "old-secret", newPassword: "new-secret", confirmPassword: "new-secret" })).toEqual({
    currentPassword: "old-secret",
    newPassword: "new-secret",
  });
  expect(() => validateProfilePasswordInput({ currentPassword: "", newPassword: "new-secret", confirmPassword: "new-secret" })).toThrow();
  expect(() => validateProfilePasswordInput({ currentPassword: "old-secret", newPassword: "short", confirmPassword: "short" })).toThrow();
  expect(() => validateProfilePasswordInput({ currentPassword: "old-secret", newPassword: "new-secret", confirmPassword: "different" })).toThrow();
});

test("normalizeProfilePhotoKind scopes upload kinds to profile-owned athlete buckets", () => {
  expect(normalizeProfilePhotoKind("profile")).toEqual({ bucket: "athlete-profile", field: "profilePhotoUrl", kind: "profile" });
  expect(normalizeProfilePhotoKind("podium")).toEqual({ bucket: "athlete-podium", field: "podiumPhotoUrl", kind: "podium" });
  expect(normalizeProfilePhotoKind("sport:running")).toEqual({
    bucket: "athlete-podium",
    field: "sportPodiumPhotoUrls",
    kind: "sport",
    sportKey: "running",
  });
  expect(() => normalizeProfilePhotoKind("sport:bad-key")).toThrow();
});
