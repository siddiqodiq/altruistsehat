import { expect, test } from "@playwright/test";
import {
  exportAthleteSelectionOptions,
  specWithDatabaseAthletePhotos,
  specWithExportAthleteSelection,
} from "../../src/lib/leaderboard/export-client";
import type { LeaderboardSpec } from "../../src/lib/leaderboard/types";

const baseSpec: LeaderboardSpec = {
  communityName: "ALTRUIST SEHAT",
  sportType: "Running",
  weekNumber: "WEEK 20",
  dateRange: "12-18 MAY 2025",
  leaderboardTitle: "TOP 10",
  leaderboardMetric: "WEEKLY MILEAGE",
  metric: "distance_km",
  trendValues: [],
  quote: "CHASING\nBETTER\nEVERY DAY",
  theme: "altruist_dark",
  athletes: [
    {
      id: "leaderboard-rakha",
      name: "Rakha Maulana",
      value: 20.9,
    },
  ],
};

test("specWithDatabaseAthletePhotos fills stale snapshot athlete photos from athlete database records", () => {
  const hydrated = specWithDatabaseAthletePhotos(baseSpec, [
    {
      id: "database-rakha",
      name: "Rakha Maulana",
      normalizedName: "rakha maulana",
      profilePhotoUrl: " https://cdn.example.com/rakha-profile.jpg ",
      podiumPhotoUrl: "https://cdn.example.com/rakha-podium.webp",
      sportPodiumPhotoUrls: {
        cycling: "https://cdn.example.com/rakha-cycling.webp",
        running: "https://cdn.example.com/rakha-running.webp",
      },
      podiumPhotoAdjustments: {
        top5: { zoom: 1.2, x: 4, y: -6 },
      },
    },
  ]);

  expect(hydrated.athletes[0]).toMatchObject({
    athleteId: "database-rakha",
    avatarDataUrl: "https://cdn.example.com/rakha-profile.jpg",
    normalizedName: "rakha maulana",
    podiumPhotoAdjustments: {
      top5: { zoom: 1.2, x: 4, y: -6 },
    },
    profilePhotoUrl: "https://cdn.example.com/rakha-profile.jpg",
    podiumPhotoUrl: "https://cdn.example.com/rakha-podium.webp",
    sportPodiumPhotoUrls: {
      cycling: "https://cdn.example.com/rakha-cycling.webp",
      running: "https://cdn.example.com/rakha-running.webp",
    },
  });
  expect(hydrated.athletes[0].id).toBe("leaderboard-rakha");
  expect(hydrated.athletes[0].name).toBe("Rakha Maulana");
  expect(hydrated.athletes[0].value).toBe(20.9);
});

test("specWithExportAthleteSelection builds a ranked top-N export spec without changing the original total", () => {
  const selected = specWithExportAthleteSelection(
    {
      ...baseSpec,
      totalOverride: undefined,
      athletes: [
        { id: "athlete-third", name: "Third", value: 30 },
        {
          id: "athlete-first",
          name: "First",
          value: 50,
          podiumPhotoUrl: "https://cdn.example.com/first.webp",
          sportPodiumPhotoUrls: { running: "https://cdn.example.com/first-running.webp" },
        },
        { id: "athlete-fourth", name: "Fourth", value: 20 },
        { id: "athlete-second", name: "Second", value: 40 },
      ],
    },
    "3",
  );

  expect(selected.leaderboardTitle).toBe("TOP 3");
  expect(selected.exportLayoutMode).toBe("top3");
  expect(selected.totalOverride).toBe(140);
  expect(selected.athletes.map((athlete) => athlete.name)).toEqual(["First", "Second", "Third"]);
  expect(selected.athletes[0]).toMatchObject({
    id: "athlete-first",
    podiumPhotoUrl: "https://cdn.example.com/first.webp",
    sportPodiumPhotoUrls: { running: "https://cdn.example.com/first-running.webp" },
    value: 50,
  });
  expect(selected.athletes[0]).not.toHaveProperty("rank");
});

test("specWithExportAthleteSelection supports top four and explicit podium top ten layouts", () => {
  const spec = {
    ...baseSpec,
    athletes: Array.from({ length: 10 }, (_, index) => ({
      id: `athlete-${index + 1}`,
      name: `Athlete ${index + 1}`,
      value: 100 - index,
    })),
  };

  const top4 = specWithExportAthleteSelection(spec, "top4");
  expect(top4.exportLayoutMode).toBe("top4");
  expect(top4.leaderboardTitle).toBe("TOP 4");
  expect(top4.athletes).toHaveLength(4);

  const podium = specWithExportAthleteSelection(spec, "podiumTop10");
  expect(podium.exportLayoutMode).toBe("podiumTop10");
  expect(podium.leaderboardTitle).toBe("TOP 10");
  expect(podium.athletes).toHaveLength(10);
});

test("exportAthleteSelectionOptions exposes non-duplicate top count choices for the current leaderboard", () => {
  const options = exportAthleteSelectionOptions({
    ...baseSpec,
    athletes: [
      { id: "athlete-first", name: "First", value: 50 },
      { id: "athlete-second", name: "Second", value: 40 },
    ],
  });

  expect(options.map((option) => [option.value, option.label, option.athleteCount])).toEqual([
    ["top2", "Top 2", 2],
    ["top1", "Top 1", 1],
  ]);
});

test("exportAthleteSelectionOptions exposes podium top ten plus top five through one for full leaderboards", () => {
  const options = exportAthleteSelectionOptions({
    ...baseSpec,
    athletes: Array.from({ length: 10 }, (_, index) => ({
      id: `athlete-${index + 1}`,
      name: `Athlete ${index + 1}`,
      value: 100 - index,
    })),
  });

  expect(options.map((option) => [option.value, option.label, option.athleteCount])).toEqual([
    ["podiumTop10", "Podium Top 10", 10],
    ["top5", "Top 5", 5],
    ["top4", "Top 4", 4],
    ["top3", "Top 3", 3],
    ["top2", "Top 2", 2],
    ["top1", "Top 1", 1],
  ]);
});
