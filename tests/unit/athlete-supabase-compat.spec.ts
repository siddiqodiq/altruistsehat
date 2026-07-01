import { expect, test } from "@playwright/test";
import {
  athleteSelectColumns,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  withoutAthletePodiumPhotoAdjustments,
  withoutAthleteSportPodiumPhotoUrls,
} from "../../src/lib/supabase/server";

test("athleteSelectColumns can omit podium adjustment columns for older Supabase schemas", () => {
  expect(athleteSelectColumns()).toContain("podium_photo_adjustments");
  expect(athleteSelectColumns()).toContain("sport_podium_photo_urls");
  expect(athleteSelectColumns({ includePodiumPhotoAdjustments: false, includeSportPodiumPhotoUrls: false })).toBe(
    "id,name,normalized_name,profile_photo_url,podium_photo_url,created_at,updated_at",
  );
});

test("isMissingAthletePodiumPhotoAdjustmentsColumn detects Supabase schema drift errors", () => {
  expect(
    isMissingAthletePodiumPhotoAdjustmentsColumn({
      message: "column athletes.podium_photo_adjustments does not exist",
      code: "42703",
    }),
  ).toBe(true);

  expect(
    isMissingAthletePodiumPhotoAdjustmentsColumn({
      message: "Could not find the 'podium_photo_adjustments' column of 'athletes' in the schema cache",
      code: "PGRST204",
    }),
  ).toBe(true);

  expect(isMissingAthletePodiumPhotoAdjustmentsColumn({ message: "network error" })).toBe(false);
});

test("isMissingAthleteSportPodiumPhotoUrlsColumn detects schema drift errors", () => {
  expect(
    isMissingAthleteSportPodiumPhotoUrlsColumn({
      message: "column athletes.sport_podium_photo_urls does not exist",
      code: "42703",
    }),
  ).toBe(true);

  expect(isMissingAthleteSportPodiumPhotoUrlsColumn({ message: "network error" })).toBe(false);
});

test("withoutAthletePodiumPhotoAdjustments removes only the optional new schema column", () => {
  expect(
    withoutAthletePodiumPhotoAdjustments({
      name: "Utha",
      normalized_name: "utha",
      podium_photo_adjustments: {},
    }),
  ).toEqual({
    name: "Utha",
    normalized_name: "utha",
  });
});

test("withoutAthleteSportPodiumPhotoUrls removes only the optional sport photo column", () => {
  expect(
    withoutAthleteSportPodiumPhotoUrls({
      name: "Utha",
      normalized_name: "utha",
      sport_podium_photo_urls: {},
    }),
  ).toEqual({
    name: "Utha",
    normalized_name: "utha",
  });
});
