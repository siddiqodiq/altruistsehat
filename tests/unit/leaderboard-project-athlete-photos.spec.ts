import { expect, test } from "@playwright/test";
import { hydrateLeaderboardProjectAthletePhotos } from "../../src/lib/leaderboard/project-athlete-photos";
import type { LeaderboardProjectState } from "../../src/lib/leaderboard/project-state";

const project: LeaderboardProjectState = {
  projectId: "leaderboard-running",
  status: "Draft",
  spec: {
    communityName: "ALTRUIST SEHAT",
    sportType: "Running",
    weekNumber: "WEEK 31",
    dateRange: "27 Jul 2026 - 2 Aug 2026",
    leaderboardTitle: "TOP 10",
    leaderboardMetric: "WEEKLY MILEAGE",
    metric: "distance_km",
    trendValues: [],
    quote: "CHASING\nBETTER\nEVERY DAY",
    theme: "altruist_dark",
    athletes: [
      { id: "leaderboard-rakha", name: "Rakha Maulana", value: 112 },
      { id: "leaderboard-rakha-duplicate", name: " Rakha   Maulana ", value: 90 },
    ],
  },
  seasonYear: "2026",
  weekNumber: "31",
  templateId: "running_weekly_mileage",
  exportHistory: [],
  updatedAt: "2026-08-10T08:00:00.000Z",
};

test("hydrateLeaderboardProjectAthletePhotos fills saved leaderboard projects from public athlete records", async () => {
  const seenNames: string[][] = [];
  const hydrated = await hydrateLeaderboardProjectAthletePhotos(project, async (names) => {
    seenNames.push(names);
    return [
      {
        id: "database-rakha",
        name: "Rakha Maulana",
        normalizedName: "rakha maulana",
        profilePhotoUrl: "https://storage.example.com/profile/rakha.webp",
        updatedAt: "2026-08-11T01:02:03.000Z",
      },
    ];
  });

  expect(seenNames).toEqual([["Rakha Maulana"]]);
  expect(hydrated.spec.athletes[0]).toMatchObject({
    athleteId: "database-rakha",
    avatarDataUrl: "https://storage.example.com/profile/rakha.webp?as_v=2026-08-11T01%3A02%3A03.000Z",
    normalizedName: "rakha maulana",
    profilePhotoUrl: "https://storage.example.com/profile/rakha.webp?as_v=2026-08-11T01%3A02%3A03.000Z",
  });
  expect(hydrated.spec.athletes[1].profilePhotoUrl).toBe(
    "https://storage.example.com/profile/rakha.webp?as_v=2026-08-11T01%3A02%3A03.000Z",
  );
});
