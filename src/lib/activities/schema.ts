import { z } from "zod";
import type { ActivityDetails, FullActivityPayload, PublicActivityPayload } from "./types";
import { coverImageForActivity } from "./schedule";

export const ACTIVITY_TYPES = [
  "Sosial",
  "Workout",
  "Competition",
] as const;

export const LEGACY_ACTIVITY_TYPES = [
  "Olahraga Bareng",
  "Sparing Olahraga",
  "Partnership Event",
  "Brand Collaboration",
  "Lainnya",
] as const;

export const SPORT_TYPES = [
  "Run",
  "Weight Training",
  "Ride",
  "Swim",
  "Trail Run",
] as const;

export const LEGACY_SPORT_TYPES = [
  "TrailRun",
  "Walk",
  "GravelRide",
  "MountainBikeRide",
  "WeightTraining",
  "Workout",
  "Yoga",
  "Hike",
  "Rowing",
  "Basket",
  "Badminton",
  "Sepakbola",
  "Tenis",
  "Padel",
] as const;

export const SCHEDULE_MODES = ["single", "weekly", "monthly", "flexible", "coming_soon"] as const;
export const ACTIVITY_VISIBILITIES = ["internal", "public"] as const;

const ALL_ACTIVITY_TYPES = [...ACTIVITY_TYPES, ...LEGACY_ACTIVITY_TYPES] as const;
const ALL_SPORT_TYPES = [...SPORT_TYPES, ...LEGACY_SPORT_TYPES] as const;

const OptionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z.string().trim().url().nullable().optional(),
);

const IsoDateStringSchema = z.string().refine((value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}, "Tanggal dan waktu tidak valid.");

const OptionalIsoDateStringSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  IsoDateStringSchema.nullable().optional(),
);

const OptionalTrimmedStringSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z.string().trim().nullable().optional(),
);

const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam harus berformat HH:mm.");
const OptionalTimeStringSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  TimeStringSchema.nullable().optional(),
);

function optionalNullableNumber(min: number, max: number) {
  return z.preprocess(
    (value) => (value === "" ? null : value),
    z.coerce.number().int().min(min).max(max).nullable().optional(),
  );
}

export const ActivityImagePayloadSchema = z.object({
  imageUrl: z.string().trim().url(),
  altText: z.string().trim().max(160).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isCover: z.coerce.boolean().optional().default(false),
});

const ActivityPayloadBaseSchema = z.object({
  name: z.string().trim().min(1, "Nama kegiatan wajib diisi."),
  activityType: z.enum(ALL_ACTIVITY_TYPES),
  sportType: z.enum(ALL_SPORT_TYPES),
  description: z.string().trim().min(1, "Deskripsi kegiatan wajib diisi."),
  location: z.string().trim().min(1, "Lokasi wajib diisi."),
  startsAt: OptionalIsoDateStringSchema,
  scheduleMode: z.enum(SCHEDULE_MODES),
  scheduleLabel: OptionalTrimmedStringSchema,
  recurrenceInterval: optionalNullableNumber(1, 4),
  recurrenceWeekday: optionalNullableNumber(0, 6),
  recurrenceMonthWeek: optionalNullableNumber(1, 4),
  recurrenceTime: OptionalTimeStringSchema,
  documentationUrl: OptionalUrlSchema,
  logoHasWhiteOutline: z.coerce.boolean().optional(),
  logoUrl: OptionalUrlSchema,
  registrationClosed: z.coerce.boolean().optional(),
  registrationEnabled: z.coerce.boolean().optional(),
  visibility: z.enum(ACTIVITY_VISIBILITIES).default("internal"),
  images: z.array(ActivityImagePayloadSchema).optional().default([]),
  participantAthleteIds: z.array(z.string().uuid()).optional().default([]),
});

const ActivityCreatePayloadSchema = ActivityPayloadBaseSchema.extend({
  logoHasWhiteOutline: z.coerce.boolean().optional().default(false),
  registrationClosed: z.coerce.boolean().optional().default(false),
  registrationEnabled: z.coerce.boolean().optional().default(false),
  scheduleMode: z.enum(SCHEDULE_MODES).default("single"),
});

function validateActivitySchedule(
  payload: z.infer<typeof ActivityPayloadBaseSchema> | Partial<z.infer<typeof ActivityPayloadBaseSchema>>,
  ctx: z.RefinementCtx,
  requireScheduleFields: boolean,
) {
  const scheduleMode = payload.scheduleMode;
  if (!scheduleMode) {
    return;
  }

  const requireField = (field: keyof typeof payload, message: string) => {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
    }
  };

  if (scheduleMode === "single") {
    requireField("startsAt", "Tanggal dan waktu wajib diisi untuk jadwal satu kali.");
  }
  if (scheduleMode === "weekly") {
    requireField("recurrenceInterval", "Interval wajib diisi untuk jadwal mingguan.");
    requireField("recurrenceWeekday", "Hari wajib dipilih untuk jadwal mingguan.");
    requireField("recurrenceTime", "Jam wajib diisi untuk jadwal mingguan.");
  }
  if (scheduleMode === "monthly") {
    requireField("recurrenceInterval", "Interval wajib diisi untuk jadwal bulanan.");
    requireField("recurrenceWeekday", "Hari wajib dipilih untuk jadwal bulanan.");
    requireField("recurrenceMonthWeek", "Minggu bulan wajib dipilih untuk jadwal bulanan.");
    requireField("recurrenceTime", "Jam wajib diisi untuk jadwal bulanan.");
  }
  if (scheduleMode === "flexible" && requireScheduleFields) {
    requireField("scheduleLabel", "Label jadwal wajib diisi untuk jadwal fleksibel.");
  }

  const coverCount = payload.images?.filter((image) => image.isCover).length ?? 0;
  if (coverCount > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pilih maksimal satu gambar sebagai cover.", path: ["images"] });
  }
}

export const ActivityPayloadSchema = ActivityCreatePayloadSchema.superRefine((payload, ctx) => {
  validateActivitySchedule(payload, ctx, true);
});

export const ActivityPatchSchema = ActivityPayloadBaseSchema.partial().extend({
  logoHasWhiteOutline: z.coerce.boolean().optional(),
  images: z.array(ActivityImagePayloadSchema).optional(),
  participantAthleteIds: z.array(z.string().uuid()).optional(),
}).superRefine((payload, ctx) => {
  validateActivitySchedule(payload, ctx, false);
});

export const ActivityParticipantsReplaceSchema = z.object({
  athleteIds: z.array(z.string().uuid()),
});

export function normalizeRegistrationPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

export const ActivityGuestRegistrationPayloadSchema = z.object({
  community: z.string().trim().min(1, "Komunitas wajib diisi.").max(120, "Komunitas maksimal 120 karakter."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120, "Nama maksimal 120 karakter."),
  phone: z.string()
    .trim()
    .min(8, "No HP minimal 8 karakter.")
    .max(32, "No HP maksimal 32 karakter.")
    .regex(/^\+?[0-9][0-9\s().-]+$/, "No HP hanya boleh berisi angka dan tanda telepon umum.")
    .refine((value) => {
      const normalized = normalizeRegistrationPhone(value);
      return normalized.length >= 8 && normalized.length <= 16;
    }, "No HP tidak valid."),
});

export type ActivityPayload = z.infer<typeof ActivityPayloadSchema>;
export type ActivityPatchPayload = z.infer<typeof ActivityPatchSchema>;
export type ActivityGuestRegistrationPayload = z.infer<typeof ActivityGuestRegistrationPayloadSchema>;

export function toPublicActivityPayload(activity: ActivityDetails): PublicActivityPayload {
  const coverImage = coverImageForActivity(activity);

  return {
    activityType: activity.activityType,
    coverImageUrl: coverImage?.imageUrl,
    description: activity.description,
    displaySchedule: activity.displaySchedule,
    id: activity.id,
    images: coverImage ? [coverImage] : [],
    location: activity.location,
    logoHasWhiteOutline: activity.logoHasWhiteOutline,
    logoUrl: activity.logoUrl,
    name: activity.name,
    registrationClosedReason: activity.registrationClosedReason,
    registrationOpen: activity.registrationOpen,
    recurrenceInterval: activity.recurrenceInterval,
    recurrenceMonthWeek: activity.recurrenceMonthWeek,
    recurrenceTime: activity.recurrenceTime,
    recurrenceWeekday: activity.recurrenceWeekday,
    scheduleLabel: activity.scheduleLabel,
    scheduleMode: activity.scheduleMode,
    sportType: activity.sportType,
    startsAt: activity.startsAt,
  };
}

export function toFullActivityPayload(activity: ActivityDetails): FullActivityPayload {
  return activity;
}
