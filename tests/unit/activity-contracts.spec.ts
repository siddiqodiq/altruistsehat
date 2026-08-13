import { expect, test } from "@playwright/test";
import {
  ACTIVITY_VISIBILITIES,
  ACTIVITY_TYPES,
  ActivityGuestRegistrationPayloadSchema,
  ActivityPatchSchema,
  SPORT_TYPES,
  ActivityPayloadSchema,
  normalizeRegistrationPhone,
  toFullActivityPayload,
  toPublicActivityPayload,
} from "../../src/lib/activities/schema";
import {
  activityHasDate,
  activityOccurrencesForMonth,
  coverImageForActivity,
} from "../../src/lib/activities/schedule";
import { groupActivitiesByActivityType } from "../../src/lib/activities/activity-groups";
import { activityRegistrationState } from "../../src/lib/activities/registration";
import {
  getActivityById,
  insertActivityRecord,
  isMissingActivityDynamicColumn,
  listActivities,
  replaceActivityImages,
  updateActivityRecord,
} from "../../src/lib/activities/server";
import type { ActivityDetails } from "../../src/lib/activities/types";

const sampleActivity: ActivityDetails = {
  id: "activity-1",
  name: "Long Run Minggu Pagi",
  activityType: "Olahraga Bareng",
  sportType: "Run",
  description: "Easy run bersama komunitas.",
  location: "GBK Senayan",
  startsAt: "2026-08-16T23:00:00.000Z",
  scheduleMode: "single",
  scheduleLabel: "17 Agu 2026, 06.00",
  displaySchedule: "17 Agu 2026, 06.00",
  documentationUrl: "https://example.com/docs",
  logoHasWhiteOutline: true,
  logoUrl: "https://example.com/logo.webp",
  registrationClosed: false,
  registrationClosedReason: undefined,
  registrationEnabled: true,
  registrationOpen: true,
  visibility: "public",
  createdBy: "auth-admin",
  images: [
    {
      id: "image-1",
      activityId: "activity-1",
      imageUrl: "https://example.com/image.jpg",
      sortOrder: 0,
      altText: "Pelari komunitas",
      isCover: true,
    },
    {
      id: "image-2",
      activityId: "activity-1",
      imageUrl: "https://example.com/second.jpg",
      sortOrder: 1,
      altText: "Foto kedua",
      isCover: false,
    },
  ],
  coverImageUrl: "https://example.com/image.jpg",
  participants: [
    {
      athleteId: "athlete-1",
      athleteName: "Marutha Wira Yuda",
      profilePhotoUrl: "https://example.com/profile.jpg",
    },
  ],
  currentAthleteParticipant: true,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const sampleActivityRow = {
  activity_type: "Workout",
  created_at: "2026-08-10T00:00:00.000Z",
  created_by: "auth-admin",
  description: "Easy run bersama komunitas.",
  documentation_url: "https://example.com/docs",
  id: "activity-1",
  location: "GBK Senayan",
  logo_has_white_outline: true,
  logo_url: "https://example.com/logo.webp",
  name: "Long Run Minggu Pagi",
  recurrence_interval: null,
  recurrence_month_week: null,
  recurrence_time: null,
  recurrence_weekday: null,
  schedule_label: "17 Agu 2026, 06.00",
  schedule_mode: "single",
  sport_type: "Run",
  starts_at: "2026-08-16T23:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  visibility: "public",
};

function activityReadSupabaseMock(
  activityResults: Array<{ data: unknown; error: unknown }>,
  activitySelects: string[] = [],
  filters: Array<{ column: string; value: string }> = [],
) {
  return {
    from(table: string) {
      if (table === "activities") {
        return {
          select(columns: string) {
            activitySelects.push(columns);
            const query = {
              eq(column: string, value: string) {
                filters.push({ column, value });
                return query;
              },
              order() {
                return query;
              },
              limit: async () => activityResults.shift(),
              single: async () => activityResults.shift(),
            };
            return query;
          },
        };
      }

      if (table === "activity_images") {
        return {
          select() {
            const query = {
              in() {
                return query;
              },
              order: async () => ({ data: [], error: null }),
            };
            return query;
          },
        };
      }

      if (table === "activity_participants") {
        return {
          select() {
            return {
              in: async () => ({ data: [], error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test("activity constants keep the required presets", () => {
  expect(ACTIVITY_TYPES).toEqual(["Sosial", "Workout", "Competition"]);
  expect(SPORT_TYPES).toEqual(
    ["Run", "Weight Training", "Ride", "Swim", "Trail Run"],
  );
  expect(ACTIVITY_VISIBILITIES).toEqual(["internal", "public"]);
});

test("activity type grouping keeps known categories first without hiding internal race events", () => {
  const workoutEvent = { ...sampleActivity, activityType: "Workout", id: "workout-event" };
  const socialEvent = { ...sampleActivity, activityType: "Sosial", id: "social-event" };
  const raceEvent = { ...sampleActivity, activityType: "Competition", id: "race-event", visibility: "internal" as const };
  const partnershipEvent = { ...sampleActivity, activityType: "Partnership Event", id: "partnership-event" };
  const brandEvent = { ...sampleActivity, activityType: "Brand Collaboration", id: "brand-event" };

  const groups = groupActivitiesByActivityType([
    raceEvent,
    partnershipEvent,
    workoutEvent,
    brandEvent,
    socialEvent,
  ]);

  expect(groups.map((group) => group.activityType)).toEqual([
    "Sosial",
    "Workout",
    "Competition",
    "Brand Collaboration",
    "Partnership Event",
  ]);
  expect(groups.find((group) => group.activityType === "Competition")?.activities).toEqual([raceEvent]);
});

test("activity registration state requires public enabled activities that are not manually or date closed", () => {
  const futurePublic = {
    ...sampleActivity,
    registrationClosed: false,
    registrationEnabled: true,
    startsAt: "2026-08-14T00:00:00.000Z",
    visibility: "public" as const,
  };
  const now = new Date("2026-08-13T00:00:00.000Z");

  expect(activityRegistrationState(futurePublic, now)).toMatchObject({
    closedReason: undefined,
    isOpen: true,
  });
  expect(activityRegistrationState({ ...futurePublic, startsAt: "2026-08-12T23:59:59.000Z" }, now)).toMatchObject({
    closedReason: "past",
    isOpen: false,
  });
  expect(activityRegistrationState({ ...futurePublic, registrationClosed: true }, now)).toMatchObject({
    closedReason: "manual",
    isOpen: false,
  });
  expect(activityRegistrationState({ ...futurePublic, registrationEnabled: false }, now)).toMatchObject({
    closedReason: "disabled",
    isOpen: false,
  });
  expect(activityRegistrationState({ ...futurePublic, startsAt: undefined }, now)).toMatchObject({
    closedReason: undefined,
    isOpen: true,
  });
  expect(activityRegistrationState({ ...futurePublic, visibility: "internal" }, now)).toMatchObject({
    closedReason: "private",
    isOpen: false,
  });
});

test("guest registration payload trims fields and normalizes Indonesian phone numbers", () => {
  expect(
    ActivityGuestRegistrationPayloadSchema.parse({
      community: " Umum ",
      name: " Nia Runner ",
      phone: "0812 3456 7890",
    }),
  ).toEqual({
    community: "Umum",
    name: "Nia Runner",
    phone: "0812 3456 7890",
  });
  expect(normalizeRegistrationPhone("0812 3456 7890")).toBe("6281234567890");
  expect(normalizeRegistrationPhone("+62 812-3456-7890")).toBe("6281234567890");

  expect(() =>
    ActivityGuestRegistrationPayloadSchema.parse({
      community: "",
      name: "",
      phone: "abc",
    }),
  ).toThrow();
});

test("listActivities keeps public activities visible when registration columns are not migrated", async () => {
  const activitySelects: string[] = [];
  const filters: Array<{ column: string; value: string }> = [];
  const supabase = activityReadSupabaseMock(
    [
      {
        data: null,
        error: {
          code: "PGRST204",
          message: "Could not find the 'registration_enabled' column of 'activities' in the schema cache",
        },
      },
      { data: [sampleActivityRow], error: null },
    ],
    activitySelects,
    filters,
  );

  const activities = await listActivities(supabase as never, undefined, { audience: "public" });

  expect(activities).toHaveLength(1);
  expect(activities[0]).toMatchObject({
    id: "activity-1",
    name: "Long Run Minggu Pagi",
    registrationClosed: false,
    registrationEnabled: false,
    visibility: "public",
  });
  expect(filters).toContainEqual({ column: "visibility", value: "public" });
  expect(activitySelects).toHaveLength(2);
  expect(activitySelects[1]).toContain("visibility");
  expect(activitySelects[1]).not.toContain("registration_enabled");
});

test("getActivityById keeps public detail available when registration columns are not migrated", async () => {
  const activitySelects: string[] = [];
  const filters: Array<{ column: string; value: string }> = [];
  const supabase = activityReadSupabaseMock(
    [
      {
        data: null,
        error: {
          code: "PGRST204",
          message: "Could not find the 'registration_closed' column of 'activities' in the schema cache",
        },
      },
      { data: sampleActivityRow, error: null },
    ],
    activitySelects,
    filters,
  );

  const activity = await getActivityById(supabase as never, "activity-1", undefined, { audience: "public" });

  expect(activity).toMatchObject({
    id: "activity-1",
    name: "Long Run Minggu Pagi",
    registrationClosed: false,
    registrationEnabled: false,
    visibility: "public",
  });
  expect(filters).toContainEqual({ column: "id", value: "activity-1" });
  expect(filters).toContainEqual({ column: "visibility", value: "public" });
  expect(activitySelects).toHaveLength(2);
  expect(activitySelects[1]).toContain("visibility");
  expect(activitySelects[1]).not.toContain("registration_closed");
});

test("insertActivityRecord retries without a stale missing visibility column", async () => {
  const payload = ActivityPayloadSchema.parse({
    activityType: "Workout",
    description: "Easy manual run.",
    location: "GBK",
    name: "Manual Run",
    scheduleMode: "single",
    sportType: "Run",
    startsAt: "2026-08-16T23:00:00.000Z",
    visibility: "public",
    registrationEnabled: true,
    registrationClosed: false,
  });
  const inserts: unknown[] = [];
  const results = [
    {
      data: null,
      error: {
        code: "42703",
        message: "column activities.visibility does not exist",
      },
    },
    { data: { id: "new-activity" }, error: null },
  ];
  const supabase = {
    from(table: string) {
      expect(table).toBe("activities");
      return {
        insert(row: unknown) {
          inserts.push(row);
          return {
            select(columns: string) {
              expect(columns).toBe("id");
              return {
                single: async () => results.shift(),
              };
            },
          };
        },
      };
    },
  };

  const inserted = await insertActivityRecord(supabase as never, payload, "auth-user");

  expect(inserted).toEqual({ id: "new-activity" });
  expect(inserts).toHaveLength(2);
  expect(inserts[0]).toMatchObject({ registration_closed: false, registration_enabled: true, schedule_mode: "single", visibility: "public" });
  expect(inserts[1]).toMatchObject({ schedule_mode: "single" });
  expect(inserts[1]).not.toHaveProperty("visibility");
});

test("insertActivityRecord retries without a stale missing logo outline column", async () => {
  const payload = ActivityPayloadSchema.parse({
    activityType: "Workout",
    description: "Easy manual run.",
    location: "GBK",
    logoHasWhiteOutline: true,
    name: "Manual Run",
    scheduleMode: "single",
    sportType: "Run",
    startsAt: "2026-08-16T23:00:00.000Z",
    visibility: "public",
    registrationEnabled: true,
    registrationClosed: false,
  });
  const inserts: unknown[] = [];
  const results = [
    {
      data: null,
      error: {
        code: "42703",
        message: "column activities.logo_has_white_outline does not exist",
      },
    },
    { data: { id: "new-activity" }, error: null },
  ];
  const supabase = {
    from(table: string) {
      expect(table).toBe("activities");
      return {
        insert(row: unknown) {
          inserts.push(row);
          return {
            select(columns: string) {
              expect(columns).toBe("id");
              return {
                single: async () => results.shift(),
              };
            },
          };
        },
      };
    },
  };

  const inserted = await insertActivityRecord(supabase as never, payload, "auth-user");

  expect(inserted).toEqual({ id: "new-activity" });
  expect(inserts).toHaveLength(2);
  expect(inserts[0]).toMatchObject({ logo_has_white_outline: true, registration_enabled: true, visibility: "public" });
  expect(inserts[1]).toMatchObject({ registration_enabled: true, visibility: "public" });
  expect(inserts[1]).not.toHaveProperty("logo_has_white_outline");
});

test("updateActivityRecord retries stale registration controls while keeping supported fields", async () => {
  const payload = ActivityPatchSchema.parse({
    name: "Updated Manual Run",
    registrationClosed: true,
    registrationEnabled: true,
  });
  const updates: unknown[] = [];
  const results = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'registration_enabled' column of 'activities' in the schema cache",
      },
    },
    { data: { id: "activity-1" }, error: null },
  ];
  const supabase = {
    from(table: string) {
      expect(table).toBe("activities");
      return {
        update(row: unknown) {
          updates.push(row);
          return {
            eq(column: string, value: string) {
              expect(column).toBe("id");
              expect(value).toBe("activity-1");
              return {
                select(columns: string) {
                  expect(columns).toBe("id");
                  return {
                    maybeSingle: async () => results.shift(),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await updateActivityRecord(supabase as never, "activity-1", payload);

  expect(updates).toHaveLength(2);
  expect(updates[0]).toMatchObject({ name: "Updated Manual Run", registration_closed: true, registration_enabled: true });
  expect(updates[1]).toMatchObject({ name: "Updated Manual Run", registration_closed: true });
  expect(updates[1]).not.toHaveProperty("registration_enabled");
});

test("updateActivityRecord rejects updates that do not return a changed activity row", async () => {
  const payload = ActivityPatchSchema.parse({
    name: "Updated Manual Run",
  });
  const supabase = {
    from(table: string) {
      expect(table).toBe("activities");
      return {
        update() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("id");
              expect(value).toBe("activity-1");
              return {
                select(columns: string) {
                  expect(columns).toBe("id");
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
                then(resolve: (value: { error: null }) => void) {
                  resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  await expect(updateActivityRecord(supabase as never, "activity-1", payload)).rejects.toThrow("Kegiatan tidak ditemukan");
});

test("updateActivityRecord retries stale visibility updates while keeping supported fields", async () => {
  const payload = {
    description: "Updated description.",
    name: "Updated Manual Run",
    visibility: "public" as const,
  };
  const updates: unknown[] = [];
  const results = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'visibility' column of 'activities' in the schema cache",
      },
    },
    { data: { id: "activity-1" }, error: null },
  ];
  const supabase = {
    from(table: string) {
      expect(table).toBe("activities");
      return {
        update(row: unknown) {
          updates.push(row);
          return {
            eq(column: string, value: string) {
              expect(column).toBe("id");
              expect(value).toBe("activity-1");
              return {
                select(columns: string) {
                  expect(columns).toBe("id");
                  return {
                    maybeSingle: async () => results.shift(),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await updateActivityRecord(supabase as never, "activity-1", payload);

  expect(updates).toHaveLength(2);
  expect(updates[0]).toMatchObject({ description: "Updated description.", name: "Updated Manual Run", visibility: "public" });
  expect(updates[1]).toMatchObject({ description: "Updated description.", name: "Updated Manual Run" });
  expect(updates[1]).not.toHaveProperty("visibility");
});

test("updateActivityRecord retries stale logo outline updates without resetting omitted patches", async () => {
  const parsedNamePatch = ActivityPatchSchema.parse({
    name: "Updated Manual Run",
    scheduleLabel: "Manual",
    scheduleMode: "flexible",
  });
  expect(parsedNamePatch).not.toHaveProperty("logoHasWhiteOutline");

  const payload = ActivityPatchSchema.parse({
    logoHasWhiteOutline: true,
    name: "Updated Manual Run",
    scheduleLabel: "Manual",
    scheduleMode: "flexible",
  });
  const updates: unknown[] = [];
  const results = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'logo_has_white_outline' column of 'activities' in the schema cache",
      },
    },
    { data: { id: "activity-1" }, error: null },
  ];
  const supabase = {
    from(table: string) {
      expect(table).toBe("activities");
      return {
        update(row: unknown) {
          updates.push(row);
          return {
            eq(column: string, value: string) {
              expect(column).toBe("id");
              expect(value).toBe("activity-1");
              return {
                select(columns: string) {
                  expect(columns).toBe("id");
                  return {
                    maybeSingle: async () => results.shift(),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await updateActivityRecord(supabase as never, "activity-1", payload);

  expect(updates).toHaveLength(2);
  expect(updates[0]).toMatchObject({ logo_has_white_outline: true, name: "Updated Manual Run", schedule_label: "Manual", schedule_mode: "flexible" });
  expect(updates[1]).toMatchObject({ name: "Updated Manual Run", schedule_label: "Manual", schedule_mode: "flexible" });
  expect(updates[1]).not.toHaveProperty("logo_has_white_outline");
});

test("replaceActivityImages retries without is_cover when the image schema is stale", async () => {
  const imageInserts: unknown[] = [];
  const insertResults = [
    {
      error: {
        code: "PGRST204",
        message: "Could not find the 'is_cover' column of 'activity_images' in the schema cache",
      },
    },
    { error: null },
  ];
  const supabase = {
    from(table: string) {
      expect(table).toBe("activity_images");
      return {
        delete() {
          return {
            eq(column: string, value: string) {
              expect(column).toBe("activity_id");
              expect(value).toBe("activity-1");
              return Promise.resolve({ error: null });
            },
          };
        },
        insert(rows: unknown) {
          imageInserts.push(rows);
          return Promise.resolve(insertResults.shift());
        },
      };
    },
  };

  await replaceActivityImages(supabase as never, "activity-1", [
    { imageUrl: "https://example.com/cover.jpg", isCover: true, sortOrder: 0 },
  ]);

  expect(imageInserts).toHaveLength(2);
  expect(imageInserts[0]).toEqual([
    expect.objectContaining({ image_url: "https://example.com/cover.jpg", is_cover: true }),
  ]);
  expect(imageInserts[1]).toEqual([
    expect.not.objectContaining({ is_cover: expect.anything() }),
  ]);
});

test("ActivityPayloadSchema validates required fields, visibility, schedule modes, and presets", () => {
  expect(
    ActivityPayloadSchema.parse({
      name: "Long Run",
      activityType: "Competition",
      sportType: "Run",
      description: "Easy run.",
      location: "GBK",
      startsAt: "2026-08-16T23:00:00.000Z",
      scheduleMode: "single",
      documentationUrl: "https://example.com/docs",
      logoHasWhiteOutline: true,
      logoUrl: "https://example.com/logo.webp",
      registrationClosed: false,
      registrationEnabled: true,
      visibility: "public",
      images: [{ imageUrl: "https://example.com/image.jpg", isCover: true }],
    }),
  ).toMatchObject({
    activityType: "Competition",
    images: [{ imageUrl: "https://example.com/image.jpg", isCover: true }],
    logoUrl: "https://example.com/logo.webp",
    logoHasWhiteOutline: true,
    registrationClosed: false,
    registrationEnabled: true,
    scheduleMode: "single",
    sportType: "Run",
    visibility: "public",
  });

  expect(
    ActivityPayloadSchema.parse({
      name: "Yoga Legacy",
      activityType: "Workout",
      sportType: "Yoga",
      description: "Legacy routine.",
      location: "TBD",
      scheduleLabel: "Opsional",
      scheduleMode: "flexible",
    }),
  ).toMatchObject({ logoHasWhiteOutline: false, scheduleLabel: "Opsional", scheduleMode: "flexible", sportType: "Yoga", visibility: "internal" });

  expect(() =>
    ActivityPayloadSchema.parse({
      name: "Private Run",
      activityType: "Workout",
      sportType: "Run",
      description: "Visibility must be explicit.",
      location: "GBK",
      scheduleLabel: "Fleksibel",
      scheduleMode: "flexible",
      visibility: "friends-only",
    }),
  ).toThrow();

  expect(() =>
    ActivityPayloadSchema.parse({
      name: "Weekly Run",
      activityType: "Workout",
      sportType: "Run",
      description: "Weekly run.",
      location: "GBK",
      recurrenceInterval: 2,
      recurrenceTime: "06:00",
      scheduleMode: "weekly",
    }),
  ).toThrow();

  expect(() =>
    ActivityPayloadSchema.parse({
      name: "",
      activityType: "Invalid",
      sportType: "Chess",
      description: "",
      location: "",
      startsAt: "not-a-date",
      scheduleMode: "single",
      documentationUrl: "notaurl",
      logoUrl: "notaurl",
    }),
  ).toThrow();
});

test("public activity payload exposes public detail and cover while hiding participant identities, gallery, and documentation URL", () => {
  const payload = toPublicActivityPayload(sampleActivity);

  expect(payload).toMatchObject({
    activityType: "Olahraga Bareng",
    coverImageUrl: "https://example.com/image.jpg",
    sportType: "Run",
    description: "Easy run bersama komunitas.",
    displaySchedule: "17 Agu 2026, 06.00",
    id: "activity-1",
    images: [sampleActivity.images[0]],
    location: "GBK Senayan",
    logoHasWhiteOutline: true,
    logoUrl: "https://example.com/logo.webp",
    name: "Long Run Minggu Pagi",
    registrationOpen: true,
    scheduleMode: "single",
    startsAt: "2026-08-16T23:00:00.000Z",
  });
  expect(payload.images).toHaveLength(1);
  expect(payload.images[0]).toMatchObject({ imageUrl: "https://example.com/image.jpg", isCover: true });
  expect(payload).not.toHaveProperty("participants");
  expect(payload).not.toHaveProperty("documentationUrl");
  expect(payload).not.toHaveProperty("currentAthleteParticipant");
  expect(payload).not.toHaveProperty("guestRegistrations");
  expect(payload).not.toHaveProperty("registrationClosed");
  expect(payload).not.toHaveProperty("registrationEnabled");
  expect(payload).not.toHaveProperty("visibility");
});

test("full activity payload includes participant and self join state for authenticated users", () => {
  const payload = toFullActivityPayload(sampleActivity);

  expect(payload.location).toBe("GBK Senayan");
  expect(payload.documentationUrl).toBe("https://example.com/docs");
  expect(payload.logoHasWhiteOutline).toBe(true);
  expect(payload.participants).toEqual(sampleActivity.participants);
  expect(payload.currentAthleteParticipant).toBe(true);
  expect(payload.registrationClosed).toBe(false);
  expect(payload.registrationEnabled).toBe(true);
  expect(payload.registrationOpen).toBe(true);
  expect(payload.visibility).toBe("public");
});

test("coverImageForActivity prefers the admin-selected cover and falls back to the first sorted image", () => {
  expect(coverImageForActivity(sampleActivity)).toMatchObject({
    imageUrl: "https://example.com/image.jpg",
    isCover: true,
  });

  expect(
    coverImageForActivity({
      ...sampleActivity,
      images: [
        { ...sampleActivity.images[1], isCover: false, sortOrder: 4 },
        { ...sampleActivity.images[0], isCover: false, sortOrder: 1 },
      ],
    }),
  ).toMatchObject({ imageUrl: "https://example.com/image.jpg", sortOrder: 1 });
});

test("activityOccurrencesForMonth expands only dated and current-month recurring activities", () => {
  const weekly: ActivityDetails = {
    ...sampleActivity,
    id: "weekly-run",
    name: "Lari bareng",
    scheduleMode: "weekly",
    recurrenceInterval: 2,
    recurrenceWeekday: 1,
    recurrenceTime: "06:00",
    startsAt: undefined,
  };
  const monthly: ActivityDetails = {
    ...sampleActivity,
    id: "monthly-trail",
    name: "Cisadon Trail",
    scheduleMode: "monthly",
    recurrenceInterval: 1,
    recurrenceMonthWeek: 2,
    recurrenceWeekday: 6,
    recurrenceTime: "06:00",
    startsAt: undefined,
  };
  const flexible: ActivityDetails = {
    ...sampleActivity,
    id: "flexible-yoga",
    name: "Yoga",
    scheduleMode: "flexible",
    startsAt: undefined,
  };

  expect(activityOccurrencesForMonth(weekly, "2026-08-01").map((item) => item.dateKey)).toEqual([
    "2026-08-03",
    "2026-08-17",
    "2026-08-31",
  ]);
  expect(activityOccurrencesForMonth(monthly, "2026-08-01")).toEqual([
    expect.objectContaining({
      activityId: "monthly-trail",
      dateKey: "2026-08-08",
      startsAt: "2026-08-07T23:00:00.000Z",
    }),
  ]);
  expect(activityOccurrencesForMonth(flexible, "2026-08-01")).toEqual([]);
});

test("activityHasDate accepts valid startsAt values only", () => {
  expect(activityHasDate({ startsAt: "2026-08-16T23:00:00.000Z" })).toBe(true);
  expect(activityHasDate({ startsAt: undefined })).toBe(false);
  expect(activityHasDate({ startsAt: "not-a-date" })).toBe(false);
});

test("isMissingActivityDynamicColumn detects Supabase schema drift for schedule and cover columns", () => {
  expect(
    isMissingActivityDynamicColumn({
      code: "42703",
      message: "column activities.schedule_mode does not exist",
    }),
  ).toBe(true);
  expect(
    isMissingActivityDynamicColumn({
      code: "PGRST204",
      message: "Could not find the 'is_cover' column of 'activity_images' in the schema cache",
    }),
  ).toBe(true);
  expect(
    isMissingActivityDynamicColumn({
      code: "PGRST204",
      message: "Could not find the 'logo_url' column of 'activities' in the schema cache",
    }),
  ).toBe(true);
  expect(
    isMissingActivityDynamicColumn({
      code: "PGRST204",
      message: "Could not find the 'logo_has_white_outline' column of 'activities' in the schema cache",
    }),
  ).toBe(true);
  expect(
    isMissingActivityDynamicColumn({
      code: "PGRST204",
      message: "Could not find the 'visibility' column of 'activities' in the schema cache",
    }),
  ).toBe(true);
  expect(
    isMissingActivityDynamicColumn({
      code: "PGRST204",
      message: "Could not find the 'registration_enabled' column of 'activities' in the schema cache",
    }),
  ).toBe(true);
  expect(isMissingActivityDynamicColumn({ message: "network timeout" })).toBe(false);
});
