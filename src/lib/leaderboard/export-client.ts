import { STORY_FORMAT } from "./dashboard-state";
import { resolveMetricTotal } from "./metrics";
import { clampExportPhotoAdjustment, DEFAULT_EXPORT_PHOTO_ADJUSTMENTS } from "./photo-adjustments";
import { buildLeaderboardRows } from "./ranking";
import { derivePreviousWeekTotal } from "./templates";
import type {
  AthleteEntry,
  ExportLayoutMode,
  LeaderboardSpec,
  OutputFormat,
  RankedAthlete,
} from "./types";
import type { LeaderboardWeekSnapshot } from "./week-snapshots";
import { normalizeAthleteName } from "../athletes/normalize";
import type { SportPodiumPhotoUrls } from "../athletes/sport-podium-photos";
import type { AthleteRecord } from "../athletes/types";

export type ExportAthleteSelection = ExportLayoutMode | "all" | "5" | "4" | "3" | "2" | "1";

export interface ExportAthleteSelectionOption {
  value: ExportLayoutMode;
  label: string;
  athleteCount: number;
}

const compactExportLayouts = [
  { athleteCount: 5, label: "Top 5", value: "top5" },
  { athleteCount: 4, label: "Top 4", value: "top4" },
  { athleteCount: 3, label: "Top 3", value: "top3" },
  { athleteCount: 2, label: "Top 2", value: "top2" },
  { athleteCount: 1, label: "Top 1", value: "top1" },
] as const satisfies ReadonlyArray<{ athleteCount: number; label: string; value: ExportLayoutMode }>;

export const defaultExportPhotoAdjustment = DEFAULT_EXPORT_PHOTO_ADJUSTMENTS.podiumTop10;
export { clampExportPhotoAdjustment };

export function filenameFromResponse(response: Response, format: OutputFormat): string {
  const fallback = format === "story" ? "leaderboard-story.png" : "leaderboard-feed.png";
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();

  globalThis.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function exportErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : response.statusText;
    return `Export failed: ${message}`;
  }

  return `Export failed: ${response.statusText || `HTTP ${response.status}`}`;
}

export function specWithTrend(spec: LeaderboardSpec, snapshots: LeaderboardWeekSnapshot[]) {
  const trendValues = snapshots
    .slice()
    .sort((left, right) => new Date(left.exportedAt).getTime() - new Date(right.exportedAt).getTime())
    .map((snapshot) => snapshot.total)
    .filter((value) => Number.isFinite(value));

  return {
    ...spec,
    trendValues,
    previousWeekTotal: derivePreviousWeekTotal(trendValues),
  };
}

function athleteWithoutRank(athlete: RankedAthlete): AthleteEntry {
  return {
    avatarDataUrl: athlete.avatarDataUrl,
    athleteId: athlete.athleteId,
    id: athlete.id,
    name: athlete.name,
    normalizedName: athlete.normalizedName,
    podiumPhotoAdjustments: athlete.podiumPhotoAdjustments,
    podiumPhotoUrl: athlete.podiumPhotoUrl,
    sportPodiumPhotoUrls: athlete.sportPodiumPhotoUrls,
    profilePhotoUrl: athlete.profilePhotoUrl,
    value: athlete.value,
  };
}

function rankedExportAthletes(spec: LeaderboardSpec) {
  return buildLeaderboardRows(spec.athletes, 10);
}

function compactLayoutLimit(selection: ExportAthleteSelection) {
  if (selection.startsWith("top")) {
    return Number(selection.replace("top", ""));
  }

  return Number(selection);
}

function exportLayoutModeForSelection(selection: ExportAthleteSelection, rankedCount: number): ExportLayoutMode {
  if (selection === "all" || selection === "podiumTop10") {
    return rankedCount > 5 ? "podiumTop10" : (`top${Math.max(1, Math.min(5, rankedCount))}` as ExportLayoutMode);
  }

  if (
    selection === "top5" ||
    selection === "top4" ||
    selection === "top3" ||
    selection === "top2" ||
    selection === "top1"
  ) {
    return selection;
  }

  return `top${Math.max(1, Math.min(5, Number(selection)))}` as ExportLayoutMode;
}

function selectionLimit(selection: ExportAthleteSelection, rankedCount: number) {
  if (selection === "all" || selection === "podiumTop10") {
    return Math.min(10, rankedCount);
  }

  return Math.min(compactLayoutLimit(selection), rankedCount);
}

export function exportAthleteSelectionOptions(spec: LeaderboardSpec): ExportAthleteSelectionOption[] {
  const rankedCount = rankedExportAthletes(spec).length;
  if (rankedCount <= 0) {
    return [];
  }

  const options: ExportAthleteSelectionOption[] = [];

  if (rankedCount > 5) {
    options.push({
      athleteCount: Math.min(10, rankedCount),
      label: "Podium Top 10",
      value: "podiumTop10",
    });
  }

  for (const layout of compactExportLayouts) {
    if (layout.athleteCount <= rankedCount) {
      options.push({
        athleteCount: layout.athleteCount,
        label: layout.label,
        value: layout.value,
      });
    }
  }

  return options;
}

export function specWithExportAthleteSelection(
  spec: LeaderboardSpec,
  selection: ExportAthleteSelection,
): LeaderboardSpec {
  const ranked = rankedExportAthletes(spec);
  const limit = selectionLimit(selection, ranked.length);
  const athletes = ranked.slice(0, limit).map(athleteWithoutRank);
  const exportLayoutMode = exportLayoutModeForSelection(selection, ranked.length);

  return {
    ...spec,
    athletes,
    exportLayoutMode,
    leaderboardTitle: `TOP ${limit}`,
    totalOverride: resolveMetricTotal(spec.athletes, spec.totalOverride),
  };
}

function normalizedPhotoUrl(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cacheBustedPhotoUrl(value?: string, version?: string) {
  const trimmed = normalizedPhotoUrl(value);
  const cacheVersion = version?.trim();
  if (!trimmed || !cacheVersion || /^(data|blob):/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    url.searchParams.set("as_v", cacheVersion);
    return url.toString();
  } catch {
    const separator = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${separator}as_v=${encodeURIComponent(cacheVersion)}`;
  }
}

function cacheBustedSportPodiumPhotoUrls(urls: SportPodiumPhotoUrls | undefined, version?: string): SportPodiumPhotoUrls | undefined {
  if (!urls) {
    return urls;
  }

  return Object.fromEntries(
    Object.entries(urls).flatMap(([key, value]) => {
      const url = cacheBustedPhotoUrl(value, version);
      return url ? [[key, url]] : [];
    }),
  ) as SportPodiumPhotoUrls;
}

export function specWithDatabaseAthletePhotos(spec: LeaderboardSpec, databaseAthletes: AthleteRecord[]): LeaderboardSpec {
  if (!databaseAthletes.length || !spec.athletes.length) {
    return spec;
  }

  const recordsByName = new Map(
    databaseAthletes.map((athlete) => [athlete.normalizedName || normalizeAthleteName(athlete.name), athlete]),
  );

  return {
    ...spec,
    athletes: spec.athletes.map((athlete) => {
      const matched = recordsByName.get(athlete.normalizedName || normalizeAthleteName(athlete.name));
      if (!matched) {
        return athlete;
      }

      const databaseProfilePhotoUrl = cacheBustedPhotoUrl(matched.profilePhotoUrl, matched.updatedAt);
      const databasePodiumPhotoUrl = cacheBustedPhotoUrl(matched.podiumPhotoUrl, matched.updatedAt);
      const existingProfilePhotoUrl = normalizedPhotoUrl(athlete.profilePhotoUrl);
      const existingPodiumPhotoUrl = normalizedPhotoUrl(athlete.podiumPhotoUrl);
      const existingAvatarDataUrl = normalizedPhotoUrl(athlete.avatarDataUrl);
      const profilePhotoUrl = databaseProfilePhotoUrl ?? existingProfilePhotoUrl;
      const sportPodiumPhotoUrls =
        matched.sportPodiumPhotoUrls === undefined
          ? athlete.sportPodiumPhotoUrls
          : cacheBustedSportPodiumPhotoUrls(matched.sportPodiumPhotoUrls, matched.updatedAt);

      return {
        ...athlete,
        athleteId: matched.id,
        avatarDataUrl: profilePhotoUrl ?? existingAvatarDataUrl,
        normalizedName: matched.normalizedName,
        podiumPhotoAdjustments: matched.podiumPhotoAdjustments ?? athlete.podiumPhotoAdjustments,
        profilePhotoUrl,
        podiumPhotoUrl: databasePodiumPhotoUrl ?? existingPodiumPhotoUrl,
        sportPodiumPhotoUrls,
      };
    }),
  };
}

export async function downloadLeaderboardPng(spec: LeaderboardSpec, format: OutputFormat = STORY_FORMAT): Promise<string> {
  const response = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, spec }),
  });

  if (!response.ok) {
    throw new Error(await exportErrorMessage(response));
  }

  const blob = await response.blob();
  const filename = filenameFromResponse(response, format);
  downloadBlob(blob, filename);
  return filename;
}
