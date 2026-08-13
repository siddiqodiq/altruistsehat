import { normalizeAthleteName } from "@/lib/athletes/normalize";
import {
  SPORT_PODIUM_PHOTO_KEYS,
  type SportPodiumPhotoKey,
} from "@/lib/athletes/sport-podium-photos";
import type { LeaderboardWeekSnapshot } from "@/lib/leaderboard/week-snapshots";
import type { MetricType } from "@/lib/leaderboard/types";

export interface ProfileSummaryAthlete {
  id: string;
  name: string;
  normalizedName?: string;
}

export interface ProfileMileageBySport {
  metric: MetricType;
  snapshotCount: number;
  sport: string;
  templateId: string;
  total: number;
}

export interface AthleteProfileSummary {
  mileageBySport: ProfileMileageBySport[];
  sports: string[];
}

export type ProfilePhotoKind =
  | { bucket: "athlete-profile"; field: "profilePhotoUrl"; kind: "profile" }
  | { bucket: "athlete-podium"; field: "podiumPhotoUrl"; kind: "podium" }
  | {
      bucket: "athlete-podium";
      field: "sportPodiumPhotoUrls";
      kind: "sport";
      sportKey: SportPodiumPhotoKey;
    };

interface BuildAthleteProfileSummaryInput {
  activitySports: string[];
  athlete: ProfileSummaryAthlete;
  snapshots: LeaderboardWeekSnapshot[];
}

function normalizedAthleteKey(athlete: ProfileSummaryAthlete): string {
  return athlete.normalizedName?.trim() || normalizeAthleteName(athlete.name);
}

function isCurrentAthleteEntry(
  athlete: ProfileSummaryAthlete,
  entry: { athleteId?: string; name: string; normalizedName?: string },
): boolean {
  if (entry.athleteId && entry.athleteId === athlete.id) {
    return true;
  }

  const currentKey = normalizedAthleteKey(athlete);
  const entryKey = entry.normalizedName?.trim() || normalizeAthleteName(entry.name);
  return Boolean(currentKey && entryKey && currentKey === entryKey);
}

function safeMetricTotal(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function sortedSports(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function buildAthleteProfileSummary({
  activitySports,
  athlete,
  snapshots,
}: BuildAthleteProfileSummaryInput): AthleteProfileSummary {
  const sports = new Set(activitySports);
  const mileage = new Map<string, ProfileMileageBySport>();

  for (const snapshot of snapshots) {
    const entry = snapshot.spec.athletes.find((candidate) => isCurrentAthleteEntry(athlete, candidate));
    if (!entry) {
      continue;
    }

    const sport = snapshot.spec.sportType || snapshot.templateId;
    const metric = snapshot.spec.metric;
    const key = [sport, metric, snapshot.templateId].join(":");
    const current = mileage.get(key) ?? {
      metric,
      snapshotCount: 0,
      sport,
      templateId: snapshot.templateId,
      total: 0,
    };

    current.snapshotCount += 1;
    current.total += safeMetricTotal(entry.value);
    mileage.set(key, current);
    if (sport) {
      sports.add(sport);
    }
  }

  return {
    mileageBySport: Array.from(mileage.values()),
    sports: sortedSports(sports),
  };
}

export function validateProfilePasswordInput(input: unknown): {
  currentPassword: string;
  newPassword: string;
} {
  if (!input || typeof input !== "object") {
    throw new Error("Password payload tidak valid.");
  }

  const record = input as Record<string, unknown>;
  const currentPassword = String(record.currentPassword ?? "");
  const newPassword = String(record.newPassword ?? "");
  const confirmPassword = String(record.confirmPassword ?? "");

  if (!currentPassword) {
    throw new Error("Password lama wajib diisi.");
  }

  if (newPassword.length < 8) {
    throw new Error("Password baru minimal 8 karakter.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Konfirmasi password tidak sama.");
  }

  return { currentPassword, newPassword };
}

export function normalizeProfilePhotoKind(value: unknown): ProfilePhotoKind {
  const text = String(value ?? "").trim();
  if (text === "profile") {
    return { bucket: "athlete-profile", field: "profilePhotoUrl", kind: "profile" };
  }

  if (text === "podium") {
    return { bucket: "athlete-podium", field: "podiumPhotoUrl", kind: "podium" };
  }

  const sportMatch = text.match(/^sport:([a-z_]+)$/);
  const sportKey = sportMatch?.[1];
  if (sportKey && SPORT_PODIUM_PHOTO_KEYS.includes(sportKey as SportPodiumPhotoKey)) {
    return {
      bucket: "athlete-podium",
      field: "sportPodiumPhotoUrls",
      kind: "sport",
      sportKey: sportKey as SportPodiumPhotoKey,
    };
  }

  throw new Error("Jenis foto profil tidak valid.");
}
