import { expect, test } from "@playwright/test";
import {
  homeFeaturedActivities,
  homeDocumentationCovers,
  homeGalleryItems,
  homeSportTypes,
  homeSportVisuals,
  homeTimelineActivities,
} from "../../src/lib/activities/home-activity-content";
import type { ActivityListItem } from "../../src/lib/activities/api";

function activity(overrides: Partial<ActivityListItem> & Pick<ActivityListItem, "id" | "name" | "sportType">): ActivityListItem {
  const base: ActivityListItem = {
    activityType: "Workout",
    description: `${overrides.name} description`,
    displaySchedule: "06:00 WIB",
    id: overrides.id,
    images: [],
    location: "Jakarta",
    name: overrides.name,
    scheduleMode: "single",
    sportType: overrides.sportType,
    startsAt: "2026-08-10T23:00:00.000Z",
  };

  return { ...base, ...overrides };
}

test("homeSportTypes derives unique exact database sport labels from internal and public activities", () => {
  const sportTypes = homeSportTypes([
    activity({ id: "run-1", name: "Long Run", sportType: "Run", startsAt: "2026-08-10T23:00:00.000Z" }),
    activity({ id: "run-2", name: "Easy Run", sportType: "Run", startsAt: "2026-08-11T23:00:00.000Z" }),
    activity({ id: "ride-1", name: "Sunday Ride", sportType: "Ride", startsAt: "2026-08-09T23:00:00.000Z" }),
    activity({ id: "badminton-1", name: "Badminton Night", sportType: "Badminton", startsAt: "2026-08-12T23:00:00.000Z" }),
    activity({ id: "swim-1", name: "Swim Drill", sportType: "Swim", startsAt: "2026-08-08T23:00:00.000Z" }),
    activity({ id: "trail-1", name: "Trail Session", sportType: "Trail Run", startsAt: "2026-08-07T23:00:00.000Z" }),
    activity({ id: "weight-1", name: "Strength", sportType: "Weight Training", startsAt: "2026-08-06T23:00:00.000Z" }),
    activity({ id: "tenis-1", name: "Tenis Sore", sportType: "Tenis", startsAt: "2026-08-05T23:00:00.000Z" }),
  ]);

  expect(sportTypes).toEqual(["Run", "Weight Training", "Ride", "Swim", "Trail Run", "Badminton"]);
  expect(JSON.stringify(sportTypes)).not.toContain("activityCount");
  expect(JSON.stringify(sportTypes)).not.toContain("description");
});

test("homeSportVisuals exposes sport labels with representative covers without leaking activity details", () => {
  const visuals = homeSportVisuals([
    activity({
      documentationUrl: "https://example.com/internal-docs",
      id: "swim-internal",
      images: [
        {
          activityId: "swim-internal",
          altText: "Private swim cover",
          id: "swim-cover",
          imageUrl: "https://example.com/swim-cover.jpg",
          isCover: true,
          sortOrder: 0,
        },
      ],
      name: "Internal Swim",
      participants: [{ athleteId: "athlete-1", athleteName: "Private Athlete" }],
      sportType: "Swim",
      visibility: "internal",
    }),
    activity({
      id: "run-public",
      images: [
        {
          activityId: "run-public",
          altText: "Public run cover",
          id: "run-cover",
          imageUrl: "https://example.com/run-cover.jpg",
          isCover: true,
          sortOrder: 0,
        },
      ],
      name: "Public Run",
      sportType: "Run",
      startsAt: "2026-08-20T23:00:00.000Z",
      visibility: "public",
    }),
    activity({
      id: "badminton-no-cover",
      name: "Badminton",
      sportType: "Badminton",
    }),
  ]);

  expect(visuals).toEqual([
    {
      altText: "Olahraga Run",
      imageUrl: "https://example.com/run-cover.jpg",
      sportType: "Run",
    },
    {
      altText: "Olahraga Swim",
      imageUrl: "https://example.com/swim-cover.jpg",
      sportType: "Swim",
    },
    {
      altText: "Olahraga Badminton",
      sportType: "Badminton",
    },
  ]);
  expect(JSON.stringify(visuals)).not.toContain("Internal Swim");
  expect(JSON.stringify(visuals)).not.toContain("https://example.com/internal-docs");
  expect(JSON.stringify(visuals)).not.toContain("Private Athlete");
  expect(JSON.stringify(visuals)).not.toContain("visibility");
  expect(JSON.stringify(visuals)).not.toContain("activityId");
});

test("homeDocumentationCovers exposes only cover image data from internal and public activities", () => {
  const covers = homeDocumentationCovers([
    activity({
      documentationUrl: "https://example.com/internal-docs",
      id: "internal",
      images: [
        {
          activityId: "internal",
          altText: "Internal activity cover",
          id: "internal-cover",
          imageUrl: "https://example.com/internal-cover.jpg",
          isCover: true,
          sortOrder: 1,
        },
        {
          activityId: "internal",
          altText: "Internal gallery image",
          id: "internal-gallery",
          imageUrl: "https://example.com/internal-gallery.jpg",
          isCover: false,
          sortOrder: 0,
        },
      ],
      name: "Internal Training",
      participants: [{ athleteId: "athlete-1", athleteName: "Private Athlete" }],
      sportType: "Run",
      visibility: "internal",
    }),
    activity({
      id: "public",
      images: [
        {
          activityId: "public",
          altText: "Public activity cover",
          id: "public-cover",
          imageUrl: "https://example.com/public-cover.jpg",
          isCover: true,
          sortOrder: 0,
        },
      ],
      name: "Public Race",
      sportType: "Ride",
      visibility: "public",
    }),
  ]);

  expect(covers).toEqual([
    {
      altText: "Dokumentasi kegiatan",
      id: "public-cover",
      imageUrl: "https://example.com/public-cover.jpg",
    },
    {
      altText: "Dokumentasi kegiatan",
      id: "internal-cover",
      imageUrl: "https://example.com/internal-cover.jpg",
    },
  ]);
  expect(JSON.stringify(covers)).not.toContain("Internal Training");
  expect(JSON.stringify(covers)).not.toContain("https://example.com/internal-docs");
  expect(JSON.stringify(covers)).not.toContain("Private Athlete");
  expect(JSON.stringify(covers)).not.toContain("visibility");
  expect(JSON.stringify(covers)).not.toContain("activityId");
});

test("homeGalleryItems prioritizes cover images and then image sort order", () => {
  const galleryItems = homeGalleryItems([
    activity({
      coverImageUrl: "https://example.com/cover-b.jpg",
      id: "older",
      images: [
        {
          activityId: "older",
          altText: "Older normal",
          id: "older-normal",
          imageUrl: "https://example.com/older-normal.jpg",
          isCover: false,
          sortOrder: 0,
        },
      ],
      name: "Older Activity",
      sportType: "Ride",
      startsAt: "2026-08-05T23:00:00.000Z",
    }),
    activity({
      id: "newer",
      images: [
        {
          activityId: "newer",
          altText: "Second image",
          id: "newer-second",
          imageUrl: "https://example.com/second.jpg",
          isCover: false,
          sortOrder: 1,
        },
        {
          activityId: "newer",
          altText: "Cover image",
          id: "newer-cover",
          imageUrl: "https://example.com/cover.jpg",
          isCover: true,
          sortOrder: 4,
        },
        {
          activityId: "newer",
          id: "newer-first",
          imageUrl: "https://example.com/first.jpg",
          isCover: false,
          sortOrder: 0,
        },
      ],
      name: "Newer Activity",
      sportType: "Run",
      startsAt: "2026-08-10T23:00:00.000Z",
    }),
  ]);

  expect(galleryItems.map((item) => item.id)).toEqual([
    "newer-cover",
    "newer-first",
    "newer-second",
    "older-normal",
  ]);
  expect(galleryItems[0]).toMatchObject({
    activityName: "Newer Activity",
    altText: "Cover image",
    imageUrl: "https://example.com/cover.jpg",
    isCover: true,
  });
  expect(galleryItems[1].altText).toBe("Dokumentasi Newer Activity");
});

test("homeFeaturedActivities keeps undated activities available while homeTimelineActivities only shows dated items", () => {
  const activities = [
    activity({ id: "soon", name: "Coming Soon", scheduleMode: "coming_soon", sportType: "Run", startsAt: undefined }),
    activity({ id: "old", name: "Old Event", sportType: "Ride", startsAt: "2026-08-01T23:00:00.000Z" }),
    activity({ id: "new", name: "New Event", sportType: "Swim", startsAt: "2026-08-20T23:00:00.000Z" }),
  ];

  expect(homeFeaturedActivities(activities, 2).map((item) => item.id)).toEqual(["new", "old"]);
  expect(homeFeaturedActivities(activities, 3).map((item) => item.id)).toEqual(["new", "old", "soon"]);
  expect(homeTimelineActivities(activities).map((item) => item.id)).toEqual(["new", "old"]);
});
