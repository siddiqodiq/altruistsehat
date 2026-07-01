import { z } from "zod";
import { SportPodiumPhotoUrlsSchema } from "@/lib/athletes/sport-podium-photos-schema";
import { SPORT_OPTIONS, type LeaderboardSpec, type SportType } from "./types";

export const OutputFormatSchema = z.enum(["story", "feed"]);
export const MetricTypeSchema = z.enum([
  "distance_km",
  "cycling_distance_km",
  "elevation_m",
  "time_minutes",
  "activities_count",
]);
export const ThemeIdSchema = z.enum(["altruist_dark", "strava_orange", "minimal_white"]);
export const ExportLayoutModeSchema = z.enum(["podiumTop10", "top5", "top4", "top3", "top2", "top1"]);

const ExportPhotoAdjustmentSchema = z.object({
  zoom: z.number().finite().min(0.8).max(2.2),
  x: z.number().finite().min(-40).max(40),
  y: z.number().finite().min(-40).max(40),
});

export const ExportPhotoAdjustmentsSchema = z.object({
  podiumTop10: z.record(z.string(), ExportPhotoAdjustmentSchema).optional(),
  top5: z.record(z.string(), ExportPhotoAdjustmentSchema).optional(),
  top4: z.record(z.string(), ExportPhotoAdjustmentSchema).optional(),
  top3: z.record(z.string(), ExportPhotoAdjustmentSchema).optional(),
  top2: z.record(z.string(), ExportPhotoAdjustmentSchema).optional(),
  top1: z.record(z.string(), ExportPhotoAdjustmentSchema).optional(),
});

export const AthletePodiumPhotoAdjustmentsSchema = z.object({
  podiumTop10: ExportPhotoAdjustmentSchema.optional(),
  top5: ExportPhotoAdjustmentSchema.optional(),
  top4: ExportPhotoAdjustmentSchema.optional(),
  top3: ExportPhotoAdjustmentSchema.optional(),
  top2: ExportPhotoAdjustmentSchema.optional(),
  top1: ExportPhotoAdjustmentSchema.optional(),
});

function normalizeSportType(value: unknown): SportType {
  const text = String(value ?? "").trim();
  const match = SPORT_OPTIONS.find((option) => option.toLowerCase() === text.toLowerCase());
  return match ?? "Running";
}

export const SportTypeSchema = z.preprocess(normalizeSportType, z.enum(SPORT_OPTIONS));

export const AthleteEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  value: z.number().finite().nonnegative(),
  athleteId: z.string().optional(),
  normalizedName: z.string().optional(),
  avatarDataUrl: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  podiumPhotoUrl: z.string().optional(),
  sportPodiumPhotoUrls: SportPodiumPhotoUrlsSchema.optional(),
  podiumPhotoAdjustments: AthletePodiumPhotoAdjustmentsSchema.optional(),
});

export const LeaderboardSpecSchema = z.object({
  communityName: z.string().min(1),
  sportType: SportTypeSchema,
  weekNumber: z.string().min(1),
  dateRange: z.string().min(1),
  leaderboardTitle: z.string().trim().min(1).default("TOP 10"),
  leaderboardMetric: z.string().trim().min(1).default("WEEKLY MILEAGE"),
  metric: MetricTypeSchema,
  totalOverride: z.number().finite().nonnegative().optional(),
  previousWeekTotal: z.number().finite().nonnegative().optional(),
  trendValues: z.array(z.number().finite().nonnegative()).default([]),
  quote: z.string().min(1),
  theme: ThemeIdSchema,
  logoDataUrl: z.string().optional(),
  athletes: z.array(AthleteEntrySchema),
  exportLayoutMode: ExportLayoutModeSchema.optional(),
  exportPhotoAdjustments: ExportPhotoAdjustmentsSchema.optional(),
});

export const ExportRequestSchema = z.object({
  format: OutputFormatSchema,
  spec: LeaderboardSpecSchema,
});

export const DEFAULT_SPEC: LeaderboardSpec = {
  communityName: "ALTRUIST SEHAT",
  sportType: "Running",
  weekNumber: "WEEK 20",
  dateRange: "12-18 MAY 2025",
  leaderboardTitle: "TOP 10",
  leaderboardMetric: "WEEKLY MILEAGE",
  metric: "distance_km",
  previousWeekTotal: 1148,
  trendValues: [1020, 1090, 1150, 1148, 1245],
  quote: "CHASING\nBETTER\nEVERY DAY",
  theme: "altruist_dark",
  athletes: [
    { id: "athlete-utha", name: "Utha", value: 145.2 },
    { id: "athlete-andi", name: "Andi", value: 140 },
    { id: "athlete-budi", name: "Budi", value: 133.3 },
    { id: "athlete-citra", name: "Citra", value: 128.4 },
    { id: "athlete-dewi", name: "Dewi", value: 124.1 },
    { id: "athlete-eko", name: "Eko", value: 120 },
    { id: "athlete-fajar", name: "Fajar", value: 116.5 },
    { id: "athlete-gita", name: "Gita", value: 112.8 },
    { id: "athlete-hana", name: "Hana", value: 112.4 },
    { id: "athlete-ivan", name: "Ivan", value: 112.3 },
  ],
};
