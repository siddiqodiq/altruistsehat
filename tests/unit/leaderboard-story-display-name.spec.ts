import { expect, test } from "@playwright/test";
import { storyDisplayName, storyPodiumNameLines } from "../../src/lib/leaderboard/story-display-name";

test("storyDisplayName keeps up to three words when the story table name fits", () => {
  expect(storyDisplayName("Ari Budi Candra Dewa", "table")).toBe("Ari Budi Candra");
});

test("storyDisplayName falls back to the previous word group instead of using ellipsis", () => {
  const displayName = storyDisplayName("Bintang Ibadurohman Putra", "table");

  expect(displayName).toBe("Bintang Ibadurohman");
  expect(displayName).not.toContain("...");
});

test("storyDisplayName falls back to first name when two words do not fit", () => {
  expect(storyDisplayName("Rahmatullahhutama Mahardika", "table")).toBe("Rahmatullahhutama");
});

test("storyPodiumNameLines splits Stefanus Zen so podium typography stays consistent", () => {
  expect(storyPodiumNameLines("Stefanus Zen")).toEqual(["Stefanus", "Zen"]);
});
