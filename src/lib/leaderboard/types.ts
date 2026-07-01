import type { SportPodiumPhotoUrls } from "@/lib/athletes/sport-podium-photos";

export type OutputFormat = "story" | "feed";

export type ExportLayoutMode = "podiumTop10" | "top5" | "top4" | "top3" | "top2" | "top1";

export const SPORT_OPTIONS = [
  "Running",
  "Riding",
  "Cycling",
  "Swimming",
  "Gym",
  "Weight Training",
  "Walking",
  "Trail Running",
  "Hiking",
] as const;

export type SportType = (typeof SPORT_OPTIONS)[number];

export type MetricType =
  | "distance_km"
  | "cycling_distance_km"
  | "elevation_m"
  | "time_minutes"
  | "activities_count";

export type ThemeId = "altruist_dark" | "strava_orange" | "minimal_white";

export interface AthleteEntry {
  id: string;
  name: string;
  value: number;
  athleteId?: string;
  normalizedName?: string;
  avatarDataUrl?: string;
  profilePhotoUrl?: string;
  podiumPhotoUrl?: string;
  sportPodiumPhotoUrls?: SportPodiumPhotoUrls;
  podiumPhotoAdjustments?: AthletePodiumPhotoAdjustments;
}

export interface ExportPhotoAdjustment {
  zoom: number;
  x: number;
  y: number;
}

export type AthletePodiumPhotoAdjustments = Partial<Record<ExportLayoutMode, ExportPhotoAdjustment>>;

export type ExportPhotoAdjustments = Partial<Record<ExportLayoutMode, Record<string, ExportPhotoAdjustment>>>;

export interface LeaderboardSpec {
  communityName: string;
  sportType: SportType;
  weekNumber: string;
  dateRange: string;
  leaderboardTitle: string;
  leaderboardMetric: string;
  metric: MetricType;
  totalOverride?: number;
  previousWeekTotal?: number;
  trendValues: number[];
  quote: string;
  theme: ThemeId;
  logoDataUrl?: string;
  athletes: AthleteEntry[];
  exportLayoutMode?: ExportLayoutMode;
  exportPhotoAdjustments?: ExportPhotoAdjustments;
}

export interface RankedAthlete extends AthleteEntry {
  rank: number;
}

export const OUTPUT_DIMENSIONS: Record<OutputFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};

export const METRIC_LABELS: Record<MetricType, string> = {
  distance_km: "Total Distance",
  cycling_distance_km: "Cycling Distance",
  elevation_m: "Elevation Gain",
  time_minutes: "Time",
  activities_count: "Activities",
};

export const METRIC_COLUMN_ALIASES: Record<MetricType, string[]> = {
  distance_km: ["distance", "distance km", "total distance", "value"],
  cycling_distance_km: ["cycling distance", "distance", "distance km", "value"],
  elevation_m: ["elevation", "elevation gain", "gain", "meters", "value"],
  time_minutes: ["time", "minutes", "value"],
  activities_count: ["activities", "activity", "activities count", "count", "value"],
};
