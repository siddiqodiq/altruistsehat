import { expect, test } from "@playwright/test";
import {
  downloadBlob,
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

test("specWithDatabaseAthletePhotos cache-busts sport podium photos with the database update timestamp", () => {
  const hydrated = specWithDatabaseAthletePhotos(
    {
      ...baseSpec,
      sportType: "Weight Training",
      athletes: [
        {
          id: "leaderboard-syahrizal",
          name: "Syahrizal Mahfiridho",
          value: 550,
          sportPodiumPhotoUrls: {
            weight_training: "https://cdn.example.com/stale-weight.webp",
          },
        },
      ],
    },
    [
      {
        id: "database-syahrizal",
        name: "Syahrizal Mahfiridho",
        normalizedName: "syahrizal mahfiridho",
        profilePhotoUrl: "https://cdn.example.com/syahrizal-profile.webp",
        podiumPhotoUrl: "https://cdn.example.com/syahrizal-podium.webp",
        sportPodiumPhotoUrls: {
          weight_training: "https://cdn.example.com/syahrizal-weight.webp",
        },
        updatedAt: "2026-07-06T08:15:00.000Z",
      },
    ],
  );

  expect(hydrated.athletes[0].profilePhotoUrl).toBe(
    "https://cdn.example.com/syahrizal-profile.webp?as_v=2026-07-06T08%3A15%3A00.000Z",
  );
  expect(hydrated.athletes[0].podiumPhotoUrl).toBe(
    "https://cdn.example.com/syahrizal-podium.webp?as_v=2026-07-06T08%3A15%3A00.000Z",
  );
  expect(hydrated.athletes[0].sportPodiumPhotoUrls).toEqual({
    weight_training: "https://cdn.example.com/syahrizal-weight.webp?as_v=2026-07-06T08%3A15%3A00.000Z",
  });
});

test("specWithDatabaseAthletePhotos treats database sport podium photos as the source of truth", () => {
  const hydrated = specWithDatabaseAthletePhotos(
    {
      ...baseSpec,
      athletes: [
        {
          id: "leaderboard-syahrizal",
          name: "Syahrizal Mahfiridho",
          value: 550,
          sportPodiumPhotoUrls: {
            weight_training: "https://cdn.example.com/stale-weight.webp",
          },
        },
      ],
    },
    [
      {
        id: "database-syahrizal",
        name: "Syahrizal Mahfiridho",
        normalizedName: "syahrizal mahfiridho",
        podiumPhotoUrl: "https://cdn.example.com/syahrizal-podium.webp",
        sportPodiumPhotoUrls: {},
        updatedAt: "2026-07-06T08:15:00.000Z",
      },
    ],
  );

  expect(hydrated.athletes[0].sportPodiumPhotoUrls).toEqual({});
  expect(hydrated.athletes[0].podiumPhotoUrl).toBe(
    "https://cdn.example.com/syahrizal-podium.webp?as_v=2026-07-06T08%3A15%3A00.000Z",
  );
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

test("downloadBlob defers object URL cleanup so the first browser download can start", () => {
  const originalDocument = globalThis.document;
  const originalUrl = globalThis.URL;
  const originalSetTimeout = globalThis.setTimeout;
  const events: string[] = [];
  const anchor = {
    click: () => events.push("click"),
    remove: () => events.push("remove"),
    download: "",
    href: "",
  } as unknown as HTMLAnchorElement;

  globalThis.document = {
    body: {
      append: () => events.push("append"),
    },
    createElement: () => anchor,
  } as unknown as Document;
  globalThis.URL = {
    createObjectURL: () => {
      events.push("create");
      return "blob:leaderboard";
    },
    revokeObjectURL: () => events.push("revoke"),
  } as unknown as typeof URL;
  globalThis.setTimeout = ((callback: TimerHandler) => {
    events.push("timeout");
    if (typeof callback === "function") {
      callback();
    }
    return 1 as unknown as NodeJS.Timeout;
  }) as unknown as typeof setTimeout;

  try {
    downloadBlob(new Blob(["png"]), "leaderboard-story.png");
  } finally {
    globalThis.document = originalDocument;
    globalThis.URL = originalUrl;
    globalThis.setTimeout = originalSetTimeout;
  }

  expect(events).toEqual(["create", "append", "click", "timeout", "remove", "revoke"]);
});
