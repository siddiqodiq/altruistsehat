import { expect, test } from "@playwright/test";
import { LeaderboardSpecSchema } from "../../src/lib/leaderboard/schema";

test("leaderboard spec schema preserves export layout and photo adjustment metadata", () => {
  const parsed = LeaderboardSpecSchema.parse({
    athletes: [
      {
        id: "athlete-1",
        name: "Athlete One",
        podiumPhotoAdjustments: {
          top4: { x: -10, y: 6, zoom: 1.1 },
        },
        sportPodiumPhotoUrls: {
          cycling: "https://cdn.example.com/athlete-one-cycling.webp",
          running: "https://cdn.example.com/athlete-one-running.webp",
        },
        value: 10,
      },
    ],
    communityName: "ALTRUIST SEHAT",
    dateRange: "22 JUN 2026 - 28 JUN 2026",
    exportLayoutMode: "top4",
    exportPhotoAdjustments: {
      top4: {
        "athlete-1": { x: 12, y: -8, zoom: 1.35 },
      },
    },
    leaderboardMetric: "WEEKLY MILEAGE",
    leaderboardTitle: "TOP 4",
    metric: "distance_km",
    quote: "CHASING BETTER EVERY DAY",
    sportType: "Running",
    theme: "altruist_dark",
    trendValues: [],
    weekNumber: "WEEK 26",
  });

  expect(parsed.exportLayoutMode).toBe("top4");
  expect(parsed.exportPhotoAdjustments?.top4?.["athlete-1"]).toEqual({ x: 12, y: -8, zoom: 1.35 });
  expect(parsed.athletes[0].podiumPhotoAdjustments?.top4).toEqual({ x: -10, y: 6, zoom: 1.1 });
  expect(parsed.athletes[0].sportPodiumPhotoUrls?.cycling).toBe("https://cdn.example.com/athlete-one-cycling.webp");
});
