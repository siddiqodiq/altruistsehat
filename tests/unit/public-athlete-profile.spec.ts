import { expect, test } from "@playwright/test";
import { buildPublicAthleteProfilePayload } from "../../src/lib/profile/public-profile";
import type { AthleteRecord } from "../../src/lib/athletes/types";
import type { LeaderboardWeekSnapshot } from "../../src/lib/leaderboard/week-snapshots";

const athlete: AthleteRecord = {
  authUserId: "auth-secret",
  id: "athlete-marutha",
  name: "Marutha Wira Yuda",
  normalizedName: "marutha wira yuda",
  profilePhotoUrl: "https://cdn.example.com/profile.webp",
  username: "marutha-wira-yuda",
};

function snapshot({
  metric = "distance_km",
  sportType,
  templateId,
  value,
  weekNumber,
}: {
  metric?: "distance_km" | "time_minutes";
  sportType: string;
  templateId: string;
  value: number;
  weekNumber: string;
}): LeaderboardWeekSnapshot {
  return {
    athleteCount: 1,
    clientId: "altruist-sehat",
    exportedAt: `2026-08-${weekNumber.padStart(2, "0")}T00:00:00.000Z`,
    seasonYear: "2026",
    spec: {
      athletes: [
        {
          athleteId: "athlete-marutha",
          id: `entry-${weekNumber}`,
          name: "Marutha Wira Yuda",
          normalizedName: "marutha wira yuda",
          value,
        },
      ],
      communityName: "Altruist Sehat",
      dateRange: "Agu 2026",
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
    total: value,
    weekNumber,
  } as LeaderboardWeekSnapshot;
}

test("buildPublicAthleteProfilePayload exposes safe profile fields and leaderboard summary", () => {
  const payload = buildPublicAthleteProfilePayload({
    athlete,
    snapshots: [
      snapshot({ sportType: "Running", templateId: "running_weekly_mileage", value: 12, weekNumber: "1" }),
      snapshot({ sportType: "Cycling", templateId: "cycling_weekly_distance", value: 30, weekNumber: "2" }),
      snapshot({ metric: "time_minutes", sportType: "Weight Training", templateId: "gym_weekly_time", value: 45, weekNumber: "3" }),
    ],
  });

  expect(payload.athlete).toEqual({
    id: "athlete-marutha",
    name: "Marutha Wira Yuda",
    normalizedName: "marutha wira yuda",
    profilePhotoUrl: "https://cdn.example.com/profile.webp",
    username: "marutha-wira-yuda",
  });
  expect(payload.athlete).not.toHaveProperty("authUserId");
  expect(payload.mileageBySport).toEqual([
    expect.objectContaining({ metric: "distance_km", snapshotCount: 1, sport: "Running", total: 12 }),
    expect.objectContaining({ metric: "distance_km", snapshotCount: 1, sport: "Cycling", total: 30 }),
    expect.objectContaining({ metric: "time_minutes", snapshotCount: 1, sport: "Weight Training", total: 45 }),
  ]);
  expect(payload.sports).toEqual(["Cycling", "Running", "Weight Training"]);
});
