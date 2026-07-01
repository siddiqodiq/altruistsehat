import { createClient } from "@supabase/supabase-js";
import type { RealtimeClientOptions } from "@supabase/realtime-js";
import WebSocket from "ws";
import { normalizeSportPodiumPhotoUrls } from "../athletes/sport-podium-photos";
import { normalizeAthletePodiumPhotoAdjustments } from "../leaderboard/photo-adjustments";

export interface AthleteRow {
  id: string;
  name: string;
  normalized_name: string;
  profile_photo_url: string | null;
  podium_photo_url: string | null;
  sport_podium_photo_urls?: unknown;
  podium_photo_adjustments?: unknown;
  created_at: string;
  updated_at: string;
}

const ATHLETE_PODIUM_ADJUSTMENTS_COLUMN = "podium_photo_adjustments";
const ATHLETE_SPORT_PODIUM_PHOTO_URLS_COLUMN = "sport_podium_photo_urls";

export const ATHLETE_PODIUM_ADJUSTMENTS_MIGRATION_MESSAGE =
  "Supabase migration missing: run supabase/migrations/20260630100000_add_athlete_podium_photo_adjustments.sql to persist podium presets.";

export const ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE =
  "Supabase migration missing: run supabase/migrations/20260701080000_add_athlete_sport_podium_photo_urls.sql to persist sport podium photo slots.";

export function athleteSelectColumns({
  includePodiumPhotoAdjustments = true,
  includeSportPodiumPhotoUrls = true,
}: {
  includePodiumPhotoAdjustments?: boolean;
  includeSportPodiumPhotoUrls?: boolean;
} = {}): string {
  const columns = ["id", "name", "normalized_name", "profile_photo_url", "podium_photo_url"];
  if (includePodiumPhotoAdjustments) {
    columns.push(ATHLETE_PODIUM_ADJUSTMENTS_COLUMN);
  }
  if (includeSportPodiumPhotoUrls) {
    columns.push(ATHLETE_SPORT_PODIUM_PHOTO_URLS_COLUMN);
  }
  columns.push("created_at", "updated_at");
  return columns.join(",");
}

function isMissingAthleteColumn(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };
  const text = [candidate.code, candidate.message, candidate.details, candidate.hint].map((value) => String(value ?? "")).join(" ").toLowerCase();

  return (
    text.includes(column) &&
    (text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find") || text.includes("42703") || text.includes("pgrst204"))
  );
}

export function isMissingAthletePodiumPhotoAdjustmentsColumn(error: unknown): boolean {
  return isMissingAthleteColumn(error, ATHLETE_PODIUM_ADJUSTMENTS_COLUMN);
}

export function isMissingAthleteSportPodiumPhotoUrlsColumn(error: unknown): boolean {
  return isMissingAthleteColumn(error, ATHLETE_SPORT_PODIUM_PHOTO_URLS_COLUMN);
}

export function withoutAthletePodiumPhotoAdjustments<T extends Record<string, unknown>>(payload: T): Omit<T, "podium_photo_adjustments"> {
  const rest = { ...payload };
  delete rest.podium_photo_adjustments;
  return rest;
}

export function withoutAthleteSportPodiumPhotoUrls<T extends Record<string, unknown>>(payload: T): Omit<T, "sport_podium_photo_urls"> {
  const rest = { ...payload };
  delete rest.sport_podium_photo_urls;
  return rest;
}

function normalizeSupabaseUrl(url: string): string {
  const dashboardMatch = url.match(/^https:\/\/supabase\.com\/dashboard\/project\/([a-z0-9]+)\/?$/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  return url;
}

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const realtimeTransport = WebSocket as unknown as NonNullable<RealtimeClientOptions["transport"]>;

  return createClient(normalizeSupabaseUrl(url), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });
}

export function mapAthleteRow(row: AthleteRow) {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    podiumPhotoUrl: row.podium_photo_url ?? undefined,
    sportPodiumPhotoUrls: normalizeSportPodiumPhotoUrls(row.sport_podium_photo_urls),
    podiumPhotoAdjustments: normalizeAthletePodiumPhotoAdjustments(row.podium_photo_adjustments),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
