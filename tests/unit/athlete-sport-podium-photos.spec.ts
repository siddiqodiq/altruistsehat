import { expect, test } from "@playwright/test";
import {
  SPORT_PODIUM_PHOTO_KEYS,
  normalizeSportPodiumPhotoUrls,
  resolveSportPodiumPhotoUrl,
  sportPodiumPhotoKeyForSport,
} from "../../src/lib/athletes/sport-podium-photos";

test("sport podium photo keys cover current leaderboard sport categories", () => {
  expect(SPORT_PODIUM_PHOTO_KEYS).toEqual(["running", "cycling", "swimming", "weight_training"]);
  expect(sportPodiumPhotoKeyForSport("Running")).toBe("running");
  expect(sportPodiumPhotoKeyForSport("Trail Running")).toBe("running");
  expect(sportPodiumPhotoKeyForSport("Cycling")).toBe("cycling");
  expect(sportPodiumPhotoKeyForSport("Riding")).toBe("cycling");
  expect(sportPodiumPhotoKeyForSport("Swimming")).toBe("swimming");
  expect(sportPodiumPhotoKeyForSport("Gym")).toBe("weight_training");
  expect(sportPodiumPhotoKeyForSport("Weight Training")).toBe("weight_training");
});

test("resolveSportPodiumPhotoUrl uses sport-specific podium photo before default uploaded podium photo", () => {
  expect(
    resolveSportPodiumPhotoUrl({
      podiumPhotoUrl: "https://cdn.example.com/default.webp",
      sportPodiumPhotoUrls: {
        cycling: "https://cdn.example.com/cycling.webp",
        running: "https://cdn.example.com/running.webp",
      },
      sportType: "Cycling",
    }),
  ).toBe("https://cdn.example.com/cycling.webp");

  expect(
    resolveSportPodiumPhotoUrl({
      podiumPhotoUrl: "https://cdn.example.com/default.webp",
      sportPodiumPhotoUrls: {
        running: "https://cdn.example.com/running.webp",
      },
      sportType: "Swimming",
    }),
  ).toBe("https://cdn.example.com/default.webp");
});

test("normalizeSportPodiumPhotoUrls keeps only current supported non-empty slots", () => {
  expect(
    normalizeSportPodiumPhotoUrls({
      cycling: " https://cdn.example.com/cycling.webp ",
      football: "https://cdn.example.com/nope.webp",
      running: "",
      swimming: null,
      weight_training: "https://cdn.example.com/gym.webp",
    }),
  ).toEqual({
    cycling: "https://cdn.example.com/cycling.webp",
    weight_training: "https://cdn.example.com/gym.webp",
  });
});
