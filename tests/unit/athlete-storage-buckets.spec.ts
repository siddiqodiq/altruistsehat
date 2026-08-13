import { expect, test } from "@playwright/test";
import { ATHLETE_STORAGE_BUCKETS } from "../../src/lib/supabase/storage";

test("athlete podium storage accepts browser crop fallback image formats", () => {
  const podiumBucket = ATHLETE_STORAGE_BUCKETS.find((bucket) => bucket.id === "athlete-podium");

  expect(podiumBucket?.allowedMimeTypes).toEqual(["image/png", "image/jpeg", "image/webp"]);
});
