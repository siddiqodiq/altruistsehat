import { expect, test } from "@playwright/test";
import {
  athletePublicSelectColumns,
  athleteSelectColumns,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  mapPublicAthleteRow,
  withoutAthletePodiumPhotoAdjustments,
  withoutAthleteSportPodiumPhotoUrls,
} from "../../src/lib/supabase/server";

test("athleteSelectColumns can omit podium adjustment columns for older Supabase schemas", () => {
  expect(athleteSelectColumns()).toContain("podium_photo_adjustments");
  expect(athleteSelectColumns()).toContain("sport_podium_photo_urls");
  expect(athleteSelectColumns()).toContain("username");
  expect(athleteSelectColumns()).toContain("auth_user_id");
  expect(athleteSelectColumns({ includePodiumPhotoAdjustments: false, includeSportPodiumPhotoUrls: false })).toBe(
    "id,name,normalized_name,username,auth_user_id,profile_photo_url,podium_photo_url,created_at,updated_at",
  );
});

test("athletePublicSelectColumns omits auth account fields from public lookup payloads", () => {
  const columns = athletePublicSelectColumns();
  expect(columns).toContain("username");
  expect(columns).not.toContain("auth_user_id");
  expect(columns).toContain("profile_photo_url");
  expect(columns).toContain("updated_at");
});

test("mapPublicAthleteRow exposes profile username without leaking auth account ids", () => {
  const athlete = mapPublicAthleteRow({
    auth_user_id: "auth-secret",
    created_at: "2026-08-01T00:00:00.000Z",
    id: "athlete-1",
    name: "Marutha Wira Yuda",
    normalized_name: "marutha wira yuda",
    podium_photo_url: null,
    profile_photo_url: "https://cdn.example.com/profile.webp",
    sport_podium_photo_urls: {},
    username: "marutha-wira-yuda",
    updated_at: "2026-08-02T00:00:00.000Z",
  });

  expect(athlete).toMatchObject({
    id: "athlete-1",
    name: "Marutha Wira Yuda",
    normalizedName: "marutha wira yuda",
    profilePhotoUrl: "https://cdn.example.com/profile.webp",
    username: "marutha-wira-yuda",
  });
  expect(athlete).not.toHaveProperty("authUserId");
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
