import type { SportType } from "@/lib/leaderboard/types";

export const SPORT_PODIUM_PHOTO_KEYS = ["running", "cycling", "swimming", "weight_training"] as const;

export type SportPodiumPhotoKey = (typeof SPORT_PODIUM_PHOTO_KEYS)[number];

export type SportPodiumPhotoUrls = Partial<Record<SportPodiumPhotoKey, string>>;

export const SPORT_PODIUM_PHOTO_LABELS: Record<SportPodiumPhotoKey, string> = {
  cycling: "Cycling",
  running: "Running",
  swimming: "Swimming",
  weight_training: "Weight Training",
};

export const SPORT_PODIUM_PHOTO_OPTIONS = SPORT_PODIUM_PHOTO_KEYS.map((key) => ({
  key,
  label: SPORT_PODIUM_PHOTO_LABELS[key],
}));

export function sportPodiumPhotoKeyForSport(sportType?: string): SportPodiumPhotoKey | undefined {
  const normalized = String(sportType ?? "").toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("cycling") || normalized.includes("riding")) {
    return "cycling";
  }

  if (normalized.includes("swimming")) {
    return "swimming";
  }

  if (normalized.includes("gym") || normalized.includes("weight")) {
    return "weight_training";
  }

  if (normalized.includes("running") || normalized.includes("run")) {
    return "running";
  }

  return undefined;
}

export function normalizeSportPodiumPhotoUrls(value: unknown): SportPodiumPhotoUrls {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const result: SportPodiumPhotoUrls = {};
  for (const key of SPORT_PODIUM_PHOTO_KEYS) {
    const url = typeof candidate[key] === "string" ? candidate[key].trim() : "";
    if (url) {
      result[key] = url;
    }
  }

  return result;
}

export function resolveSportPodiumPhotoUrl({
  podiumPhotoUrl,
  sportPodiumPhotoUrls,
  sportType,
}: {
  podiumPhotoUrl?: string;
  sportPodiumPhotoUrls?: SportPodiumPhotoUrls;
  sportType?: SportType | string;
}): string | undefined {
  const key = sportPodiumPhotoKeyForSport(sportType);
  const sportPhotoUrl = key ? sportPodiumPhotoUrls?.[key]?.trim() : undefined;
  return sportPhotoUrl || podiumPhotoUrl?.trim() || undefined;
}
