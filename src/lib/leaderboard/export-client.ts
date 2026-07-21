import { STORY_FORMAT } from "./dashboard-state";
import { downloadExportFrame } from "./export-image";
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

/** Shown when the athlete-photo lookup cannot reach the database; a reload recovers it. */
export const ATHLETE_PHOTO_FETCH_ERROR =
  "Gagal memuat foto atlet dari database. Silakan refresh halaman, lalu coba export lagi.";

export const defaultExportPhotoAdjustment = DEFAULT_EXPORT_PHOTO_ADJUSTMENTS.podiumTop10;
export { clampExportPhotoAdjustment };

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

      const databaseProfilePhotoUrl = normalizedPhotoUrl(matched.profilePhotoUrl);
      const databasePodiumPhotoUrl = normalizedPhotoUrl(matched.podiumPhotoUrl);
      const existingProfilePhotoUrl = normalizedPhotoUrl(athlete.profilePhotoUrl);
      const existingPodiumPhotoUrl = normalizedPhotoUrl(athlete.podiumPhotoUrl);
      const existingAvatarDataUrl = normalizedPhotoUrl(athlete.avatarDataUrl);
      const profilePhotoUrl = databaseProfilePhotoUrl ?? existingProfilePhotoUrl;
      const sportPodiumPhotoUrls = Object.keys(matched.sportPodiumPhotoUrls ?? {}).length
        ? matched.sportPodiumPhotoUrls
        : athlete.sportPodiumPhotoUrls;

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

/**
 * Captures the poster straight from the already-rendered preview DOM. Rendering server-side
 * needed a headless Chromium, which cannot run on serverless hosting.
 */
export async function downloadLeaderboardPng(
  container: HTMLElement | null,
  format: OutputFormat = STORY_FORMAT,
): Promise<string> {
  const { filename } = await downloadExportFrame(container, format);
  return filename;
}
