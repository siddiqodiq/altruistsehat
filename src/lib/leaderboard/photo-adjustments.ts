import type {
  AthletePodiumPhotoAdjustments,
  ExportLayoutMode,
  ExportPhotoAdjustment,
  ExportPhotoAdjustments,
  RankedAthlete,
} from "./types";

export const STORY_EXPORT_LAYOUT_MODES: ExportLayoutMode[] = ["podiumTop10", "top5", "top4", "top3", "top2", "top1"];

export const STORY_COMPACT_ROWS_STAGE_HEIGHT_PX = 1180;
export const STORY_COMPACT_ROWS_GAP_PX = 16;
export const STORY_COMPACT_PRESET_PREVIEW_MAX_HEIGHT_PX = 360;

export const STORY_EXPORT_LAYOUT_LABELS: Record<ExportLayoutMode, string> = {
  podiumTop10: "Podium Top 10",
  top5: "Top 5",
  top4: "Top 4",
  top3: "Top 3",
  top2: "Top 2",
  top1: "Top 1",
};

const DEFAULT_EXPORT_PHOTO_ADJUSTMENT: ExportPhotoAdjustment = {
  zoom: 1,
  x: 0,
  y: 0,
};

type CompactExportLayoutMode = Exclude<ExportLayoutMode, "podiumTop10">;

const COMPACT_EXPORT_ATHLETE_COUNTS: Record<CompactExportLayoutMode, number> = {
  top5: 5,
  top4: 4,
  top3: 3,
  top2: 2,
  top1: 1,
};

export type CompactPhotoTreatment = "photo" | "cutout";

export const DEFAULT_EXPORT_PHOTO_ADJUSTMENTS: Record<ExportLayoutMode, ExportPhotoAdjustment> = {
  podiumTop10: DEFAULT_EXPORT_PHOTO_ADJUSTMENT,
  top5: DEFAULT_EXPORT_PHOTO_ADJUSTMENT,
  top4: DEFAULT_EXPORT_PHOTO_ADJUSTMENT,
  top3: DEFAULT_EXPORT_PHOTO_ADJUSTMENT,
  top2: DEFAULT_EXPORT_PHOTO_ADJUSTMENT,
  top1: DEFAULT_EXPORT_PHOTO_ADJUSTMENT,
};

function finiteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampExportPhotoAdjustment(adjustment: Partial<ExportPhotoAdjustment> = {}): ExportPhotoAdjustment {
  return {
    zoom: Math.min(2.2, Math.max(0.8, finiteNumber(adjustment.zoom, DEFAULT_EXPORT_PHOTO_ADJUSTMENT.zoom))),
    x: Math.min(40, Math.max(-40, finiteNumber(adjustment.x, DEFAULT_EXPORT_PHOTO_ADJUSTMENT.x))),
    y: Math.min(40, Math.max(-40, finiteNumber(adjustment.y, DEFAULT_EXPORT_PHOTO_ADJUSTMENT.y))),
  };
}

function isLayoutMode(value: string): value is ExportLayoutMode {
  return STORY_EXPORT_LAYOUT_MODES.includes(value as ExportLayoutMode);
}

export function isCompactExportLayoutMode(layoutMode: ExportLayoutMode): layoutMode is CompactExportLayoutMode {
  return layoutMode !== "podiumTop10";
}

export function compactExportAthleteCountForLayout(layoutMode: CompactExportLayoutMode): number {
  return COMPACT_EXPORT_ATHLETE_COUNTS[layoutMode];
}

export function compactExportRowHeightPx(rowCount: number): number {
  const safeRowCount = Math.max(1, Math.min(5, Math.round(rowCount)));
  const totalGapHeight = STORY_COMPACT_ROWS_GAP_PX * Math.max(0, safeRowCount - 1);
  return (STORY_COMPACT_ROWS_STAGE_HEIGHT_PX - totalGapHeight) / safeRowCount;
}

export function compactPresetPreviewHeightPx(
  layoutMode: CompactExportLayoutMode,
  maxHeightPx = STORY_COMPACT_PRESET_PREVIEW_MAX_HEIGHT_PX,
): number {
  const rowHeight = compactExportRowHeightPx(compactExportAthleteCountForLayout(layoutMode));
  const topOneRowHeight = compactExportRowHeightPx(1);

  return Math.round((rowHeight / topOneRowHeight) * maxHeightPx);
}

function adjustedObjectPosition(adjustment: ExportPhotoAdjustment): string {
  const x = Math.min(100, Math.max(0, 50 + adjustment.x));
  const y = Math.min(100, Math.max(0, 50 + adjustment.y));

  return `${x}% ${y}%`;
}

function compactPhotoTranslate(adjustment: ExportPhotoAdjustment): string {
  const x = Math.min(40, Math.max(-40, finiteNumber(adjustment.x, DEFAULT_EXPORT_PHOTO_ADJUSTMENT.x)));
  const y = Math.min(40, Math.max(-40, finiteNumber(adjustment.y, DEFAULT_EXPORT_PHOTO_ADJUSTMENT.y)));

  return `translate(${x}%, ${y}%)`;
}

export function fullFramePhotoAdjustmentStyle(adjustment: ExportPhotoAdjustment): {
  objectPosition: string;
  transform: string;
  transformOrigin: "center center";
} {
  return {
    objectPosition: adjustedObjectPosition(adjustment),
    transform: `scale(${Math.max(1, adjustment.zoom)})`,
    transformOrigin: "center center",
  };
}

export function compactPhotoForegroundAdjustmentStyle(adjustment: ExportPhotoAdjustment): {
  objectPosition: string;
  transform: string;
  transformOrigin: "center center";
} {
  const zoom = Math.min(2.2, Math.max(0.8, finiteNumber(adjustment.zoom, DEFAULT_EXPORT_PHOTO_ADJUSTMENT.zoom)));

  return {
    objectPosition: "50% 50%",
    transform: `${compactPhotoTranslate(adjustment)} scale(${zoom})`,
    transformOrigin: "center center",
  };
}

export function compactPhotoTreatmentForImage(photoUrl?: string, hasTransparency = false): CompactPhotoTreatment {
  if (hasTransparency) {
    return "cutout";
  }

  const normalized = (photoUrl ?? "").toLowerCase();
  if (!normalized) {
    return "photo";
  }

  if (normalized.startsWith("data:image/png") || normalized.includes("cutout") || normalized.includes("transparent") || /\.png(?:[?#]|$)/.test(normalized)) {
    return "cutout";
  }

  return "photo";
}

export function compactCutoutBackdropStyle(rank?: number): { background: string } {
  const accent =
    rank === 1
      ? "255, 199, 44"
      : rank === 2
        ? "226, 232, 240"
        : rank === 3
          ? "196, 123, 53"
          : "94, 122, 94";

  return {
    background: [
      `radial-gradient(circle at 28% 34%, rgba(${accent}, 0.34) 0%, rgba(${accent}, 0.12) 28%, transparent 56%)`,
      `linear-gradient(110deg, rgba(${accent}, 0.20) 0%, rgba(21, 26, 20, 0.92) 44%, rgba(5, 5, 5, 0.98) 100%)`,
    ].join(", "),
  };
}

function normalizeSingleAdjustment(value: unknown): ExportPhotoAdjustment | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<ExportPhotoAdjustment>;
  return clampExportPhotoAdjustment(candidate);
}

export function normalizeAthletePodiumPhotoAdjustments(value: unknown): AthletePodiumPhotoAdjustments {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: AthletePodiumPhotoAdjustments = {};
  for (const [layoutMode, adjustment] of Object.entries(value)) {
    if (!isLayoutMode(layoutMode)) {
      continue;
    }

    const normalized = normalizeSingleAdjustment(adjustment);
    if (normalized) {
      result[layoutMode] = normalized;
    }
  }

  return result;
}

export function resolveAthletePhotoAdjustment({
  athlete,
  exportPhotoAdjustments,
  layoutMode,
}: {
  athlete: RankedAthlete;
  exportPhotoAdjustments?: ExportPhotoAdjustments;
  layoutMode: ExportLayoutMode;
}): ExportPhotoAdjustment {
  const exportOverride = exportPhotoAdjustments?.[layoutMode]?.[athlete.id];
  if (exportOverride) {
    return clampExportPhotoAdjustment(exportOverride);
  }

  const athletePreset = athlete.podiumPhotoAdjustments?.[layoutMode];
  if (athletePreset) {
    return clampExportPhotoAdjustment(athletePreset);
  }

  return DEFAULT_EXPORT_PHOTO_ADJUSTMENTS[layoutMode];
}
