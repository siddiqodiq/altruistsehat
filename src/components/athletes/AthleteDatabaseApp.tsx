"use client";

import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Crop, Download, Edit3, FileUp, ImagePlus, Plus, Search, Trash2, X } from "lucide-react";
import {
  createAthlete,
  deleteAthleteRecord,
  downloadAthletePhoto,
  importAthletes,
  listAthletes,
  updateAthleteRecord,
  uploadAthleteImage,
  validateAthleteStorage,
  type AthletePayload,
} from "@/lib/athletes/api";
import { clearAthleteLookupCache } from "@/lib/athletes/client-cache";
import {
  ATHLETE_IMAGE_CROP_PRESETS,
  centeredCropFrame,
  clampCropFrame,
  cropImageFile,
  readImageFile,
  type AthleteImageKind,
  type CropFrame,
  type ImageDimensions,
} from "@/lib/athletes/image-crop";
import { parseAthleteImportCsv, type AthleteImportRow } from "@/lib/athletes/import";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import type { AthletePhotoKind } from "@/lib/athletes/photo-download";
import {
  normalizeSportPodiumPhotoUrls,
  SPORT_PODIUM_PHOTO_OPTIONS,
  type SportPodiumPhotoKey,
  type SportPodiumPhotoUrls,
} from "@/lib/athletes/sport-podium-photos";
import type { AthleteRecord } from "@/lib/athletes/types";
import { initialsForName } from "@/lib/leaderboard/images";
import {
  clampExportPhotoAdjustment,
  compactCutoutBackdropStyle,
  compactExportAthleteCountForLayout,
  compactPhotoBackgroundAdjustmentStyle,
  compactPhotoForegroundAdjustmentStyle,
  compactPhotoTreatmentForImage,
  compactPresetPreviewHeightPx,
  DEFAULT_EXPORT_PHOTO_ADJUSTMENTS,
  isCompactExportLayoutMode,
  STORY_EXPORT_LAYOUT_LABELS,
  STORY_EXPORT_LAYOUT_MODES,
} from "@/lib/leaderboard/photo-adjustments";
import type { AthletePodiumPhotoAdjustments, ExportLayoutMode, ExportPhotoAdjustment } from "@/lib/leaderboard/types";
import { cn } from "@/lib/utils";

interface AthleteFormState {
  id?: string;
  name: string;
  profilePhotoUrl: string;
  podiumPhotoUrl: string;
  sportPodiumPhotoUrls: SportPodiumPhotoUrls;
  podiumPhotoAdjustments: AthletePodiumPhotoAdjustments;
  profilePreviewUrl: string;
  podiumPreviewUrl: string;
  sportPodiumPreviewUrls: Partial<Record<SportPodiumPhotoKey, string>>;
  podiumPreviewHasTransparency?: boolean;
  pendingProfileFile?: File;
  pendingPodiumFile?: File;
  pendingSportPodiumFiles: Partial<Record<SportPodiumPhotoKey, File>>;
}

interface CropSession {
  kind: AthleteImageKind;
  sportPodiumPhotoKey?: SportPodiumPhotoKey;
  file: File;
  image: HTMLImageElement;
  dataUrl: string;
  dimensions: ImageDimensions;
  frame: CropFrame;
}

interface AthleteToast {
  message: string;
  tone: "success" | "error";
}

const EMPTY_FORM: AthleteFormState = {
  name: "",
  profilePhotoUrl: "",
  podiumPhotoUrl: "",
  sportPodiumPhotoUrls: {},
  podiumPhotoAdjustments: {},
  profilePreviewUrl: "",
  podiumPreviewUrl: "",
  sportPodiumPreviewUrls: {},
  pendingSportPodiumFiles: {},
};

function inputClassName(extra?: string) {
  return cn(
    "min-h-11 w-full rounded-[8px] border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-200",
    extra,
  );
}

function buttonClassName(extra?: string) {
  return cn(
    "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[8px] text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
    extra,
  );
}

function formPayload(form: AthleteFormState): AthletePayload {
  return {
    name: form.name.trim(),
    podiumPhotoAdjustments: form.podiumPhotoAdjustments,
    profilePhotoUrl: form.profilePhotoUrl.trim() || undefined,
    podiumPhotoUrl: form.podiumPhotoUrl.trim() || undefined,
    sportPodiumPhotoUrls: normalizeSportPodiumPhotoUrls(form.sportPodiumPhotoUrls),
  };
}

function revokePreviewUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function revokeFormPreviews(form: AthleteFormState) {
  revokePreviewUrl(form.profilePreviewUrl);
  revokePreviewUrl(form.podiumPreviewUrl);
  Object.values(form.sportPodiumPreviewUrls).forEach(revokePreviewUrl);
}

function formFromAthlete(athlete: AthleteRecord): AthleteFormState {
  return {
    id: athlete.id,
    name: athlete.name,
    profilePhotoUrl: athlete.profilePhotoUrl ?? "",
    podiumPhotoUrl: athlete.podiumPhotoUrl ?? "",
    sportPodiumPhotoUrls: athlete.sportPodiumPhotoUrls ?? {},
    podiumPhotoAdjustments: athlete.podiumPhotoAdjustments ?? {},
    profilePreviewUrl: "",
    podiumPreviewUrl: "",
    sportPodiumPreviewUrls: {},
    pendingSportPodiumFiles: {},
  };
}

function ProfilePreview({ athlete }: { athlete: AthleteRecord }) {
  return (
    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-950 text-sm font-black text-white dark:bg-zinc-100 dark:text-zinc-950">
      {athlete.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={athlete.profilePhotoUrl} />
      ) : (
        initialsForName(athlete.name)
      )}
    </div>
  );
}

function PodiumPreview({ athlete }: { athlete: AthleteRecord }) {
  return (
    <div className="grid h-16 w-10 shrink-0 place-items-end overflow-hidden rounded-[8px] border border-zinc-200 bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f4f4f5_75%),linear-gradient(-45deg,transparent_75%,#f4f4f5_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0] dark:border-zinc-700">
      {athlete.podiumPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${athlete.name} podium`} className="h-full w-full object-cover object-center" src={athlete.podiumPhotoUrl} />
      ) : (
        <span className="m-auto text-xs font-black text-zinc-400">{initialsForName(athlete.name)}</span>
      )}
    </div>
  );
}

function ImportAthleteModal({
  error,
  importing,
  onClose,
  onFileChange,
  onImport,
  rows,
}: {
  error: string;
  importing: boolean;
  onClose: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  rows: AthleteImportRow[];
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-primary-charcoal/50 px-5 py-8 backdrop-blur-sm">
      <section
        aria-label="Import CSV"
        aria-modal="true"
        className="max-h-full w-full max-w-2xl overflow-hidden rounded-[8px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-zinc-950 dark:text-zinc-50">Import CSV</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Bulk create athletes by name. Photos stay empty.</p>
          </div>
          <button
            className="grid size-9 cursor-pointer place-items-center rounded-[8px] border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            title="Close import"
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5">
          <label className="grid min-h-36 cursor-pointer place-items-center rounded-[8px] border border-dashed border-zinc-300 bg-zinc-50 px-4 text-center text-sm font-black text-zinc-700 transition hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <FileUp size={24} />
            <span>Drag CSV Here</span>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">or Choose File</span>
            <input accept=".csv,text/csv" aria-label="Choose CSV file" className="sr-only" onChange={onFileChange} type="file" />
          </label>

          {error ? <div className="rounded-[8px] bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}

          {rows.length ? (
            <div className="grid gap-3">
              <div className="text-sm font-black text-zinc-700 dark:text-zinc-200">{rows.length} athletes detected</div>
              <div className="max-h-64 overflow-auto rounded-[8px] border border-zinc-200 dark:border-zinc-800">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs font-black uppercase tracking-[0.05em] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row) => (
                      <tr className="border-t border-zinc-100 dark:border-zinc-800" key={`${row.rowNumber}-${row.normalizedName}`}>
                        <td className="px-3 py-2 font-semibold text-zinc-800 dark:text-zinc-200">{row.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 ? <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Showing first 100 names.</div> : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button className={buttonClassName("border border-zinc-200 bg-white px-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={buttonClassName("bg-zinc-950 px-4 text-white dark:bg-zinc-50 dark:text-zinc-950")}
            disabled={!rows.length || importing}
            onClick={onImport}
            type="button"
          >
            {importing ? "Importing..." : "Import Athletes"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ImageUploadControl({
  description,
  kind,
  onFileChange,
  pending,
  previewUrl,
}: {
  description: string;
  kind: AthleteImageKind;
  onFileChange: (kind: AthleteImageKind, event: ChangeEvent<HTMLInputElement>) => void;
  pending: boolean;
  previewUrl: string;
}) {
  const preset = ATHLETE_IMAGE_CROP_PRESETS[kind];
  const isProfile = kind === "profile";

  return (
    <div className="grid gap-3 rounded-[8px] border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-zinc-800 dark:text-zinc-100">{preset.label}</div>
          <div className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{description}</div>
        </div>
        {pending ? (
          <span className="rounded-full bg-primary-green/12 px-2 py-1 text-[11px] font-black uppercase tracking-[0.04em] text-primary-green dark:bg-secondary-teal/15 dark:text-secondary-teal">
            Cropped
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden border border-zinc-200 bg-white text-xs font-black text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950",
            isProfile ? "size-20 rounded-full" : "h-28 w-[70px] rounded-[8px]",
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${preset.label} preview`} className="h-full w-full object-cover object-center" src={previewUrl} />
          ) : (
            <ImagePlus size={20} />
          )}
        </div>
        <label className={buttonClassName("flex-1 border border-dashed border-zinc-300 bg-white px-3 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")}>
          <Crop size={16} />
          Choose & Crop
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Choose ${preset.label.toLowerCase()} file`}
            className="sr-only"
            onChange={(event) => onFileChange(kind, event)}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}

function SportPodiumPhotoSlots({
  defaultPreviewUrl,
  onFileChange,
  onUrlChange,
  pendingFiles,
  previewUrls,
  sportPhotoUrls,
}: {
  defaultPreviewUrl: string;
  onFileChange: (key: SportPodiumPhotoKey, event: ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (key: SportPodiumPhotoKey, value: string) => void;
  pendingFiles: Partial<Record<SportPodiumPhotoKey, File>>;
  previewUrls: Partial<Record<SportPodiumPhotoKey, string>>;
  sportPhotoUrls: SportPodiumPhotoUrls;
}) {
  return (
    <section className="grid gap-3 rounded-[8px] border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div>
        <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Sport Podium Photos</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
          Default podium photo is used when a sport slot is empty.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SPORT_PODIUM_PHOTO_OPTIONS.map((option) => {
          const specificPreviewUrl = previewUrls[option.key] || sportPhotoUrls[option.key] || "";
          const previewUrl = specificPreviewUrl || defaultPreviewUrl;
          const usesFallback = !specificPreviewUrl;

          return (
            <div className="grid gap-2 rounded-[8px] border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950" key={option.key}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-black uppercase tracking-[0.08em] text-zinc-700 dark:text-zinc-200">{option.label}</div>
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em]", usesFallback ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400" : "bg-primary-green/12 text-primary-green")}>
                  {pendingFiles[option.key] ? "Cropped" : usesFallback ? "Fallback" : "Custom"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-20 w-[52px] shrink-0 place-items-center overflow-hidden rounded-[8px] border border-zinc-200 bg-zinc-100 text-xs font-black text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`${option.label} podium preview`} className="h-full w-full object-cover object-center" src={previewUrl} />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                </div>
                <div className="grid min-w-0 flex-1 gap-2">
                  <input
                    className={inputClassName("h-9 min-h-9 text-xs")}
                    onChange={(event) => onUrlChange(option.key, event.target.value)}
                    placeholder={`${option.label} podium URL`}
                    value={sportPhotoUrls[option.key] ?? ""}
                  />
                  <label className={buttonClassName("h-9 border border-dashed border-zinc-300 bg-white px-3 text-xs text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")}>
                    <Crop size={14} />
                    Choose & Crop
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      aria-label={`Choose ${option.label.toLowerCase()} podium file`}
                      className="sr-only"
                      onChange={(event) => onFileChange(option.key, event)}
                      type="file"
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function layoutPreviewClassName(layoutMode: ExportLayoutMode) {
  if (layoutMode === "podiumTop10") {
    return "aspect-[5/8] max-w-[190px]";
  }

  return "w-full";
}

function presetPreviewImageStyle(adjustment: ExportPhotoAdjustment): CSSProperties {
  const x = Math.min(100, Math.max(0, 50 + adjustment.x));
  const y = Math.min(100, Math.max(0, 50 + adjustment.y));

  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${Math.max(1, adjustment.zoom)})`,
    transformOrigin: "center center",
  };
}

function compactPresetPreviewFrameStyle(layoutMode: Exclude<ExportLayoutMode, "podiumTop10">): CSSProperties {
  return {
    height: `${compactPresetPreviewHeightPx(layoutMode)}px`,
  };
}

function PodiumPresetPreview({
  adjustment,
  hasTransparency,
  layoutMode,
  previewUrl,
}: {
  adjustment: ExportPhotoAdjustment;
  hasTransparency?: boolean;
  layoutMode: ExportLayoutMode;
  previewUrl: string;
}) {
  const compactLayoutMode = isCompactExportLayoutMode(layoutMode) ? layoutMode : undefined;
  const compactRowCount = compactLayoutMode ? compactExportAthleteCountForLayout(compactLayoutMode) : undefined;
  const compactTreatment = compactPhotoTreatmentForImage(previewUrl, hasTransparency);
  const foregroundMask = {
    WebkitMaskImage: "linear-gradient(to right, #000 0%, #000 58%, rgba(0,0,0,0.76) 76%, transparent 100%)",
    maskImage: "linear-gradient(to right, #000 0%, #000 58%, rgba(0,0,0,0.76) 76%, transparent 100%)",
  };

  return (
    <div className="grid place-items-center rounded-[8px] border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div
        className={cn(
          "relative overflow-hidden rounded-[8px] border border-zinc-300 bg-zinc-950 shadow-[0_18px_42px_rgba(0,0,0,0.18)]",
          layoutPreviewClassName(layoutMode),
        )}
        data-export-layout={layoutMode}
        data-export-row-count={compactRowCount}
        data-export-row-height-preview={compactLayoutMode ? compactPresetPreviewHeightPx(compactLayoutMode) : undefined}
        style={compactLayoutMode ? compactPresetPreviewFrameStyle(compactLayoutMode) : undefined}
      >
        {compactRowCount ? (
          <>
            <div className="absolute inset-0" data-layer="compact-cutout-backdrop" style={compactCutoutBackdropStyle()} />
            {previewUrl ? (
              <>
                {compactTreatment === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover object-center opacity-70 blur-xl saturate-110"
                    data-fit-strategy="dual-layer-background-fill"
                    data-image-layer="compact-photo-background"
                    src={previewUrl}
                    style={compactPhotoBackgroundAdjustmentStyle(adjustment)}
                  />
                ) : null}
                <div className="absolute inset-0" style={foregroundMask}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`${STORY_EXPORT_LAYOUT_LABELS[layoutMode]} preset preview`}
                    className="h-full w-full object-contain object-center opacity-95 drop-shadow-[0_14px_28px_rgba(0,0,0,0.42)]"
                    data-fit-strategy={compactTreatment === "cutout" ? "cutout-podium-backdrop" : "dual-layer-blend-foreground"}
                    data-image-layer="compact-photo-foreground"
                    data-image-position="adjustable-foreground"
                    src={previewUrl}
                    style={compactPhotoForegroundAdjustmentStyle(adjustment)}
                  />
                </div>
              </>
            ) : (
              <div className="grid h-full w-full place-items-center text-xs font-black uppercase tracking-[0.1em] text-white/35">No Photo</div>
            )}
            <div
              className="absolute inset-0 z-10"
              style={{
                background:
                  "linear-gradient(to left, rgba(5,5,5,0.84) 0%, rgba(5,5,5,0.54) 38%, rgba(5,5,5,0.12) 100%)",
              }}
            />
            <div className="absolute right-2 top-2 z-20 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
              {compactRowCount} athlete{compactRowCount === 1 ? "" : "s"}
            </div>
          </>
        ) : (
          <>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${STORY_EXPORT_LAYOUT_LABELS[layoutMode]} preset preview`}
                className="h-full w-full object-cover object-center opacity-90"
                src={previewUrl}
                style={presetPreviewImageStyle(adjustment)}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs font-black uppercase tracking-[0.1em] text-white/35">No Photo</div>
            )}
            <div className="absolute inset-x-[18%] top-[15%] h-[18%] rounded-full border border-[#FFC72C]/70" data-guide="face" />
            <div className="absolute inset-x-[23%] top-[34%] h-[42%] rounded-t-[45%] border border-white/45" data-guide="torso" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.36),rgba(0,0,0,0)_44%,rgba(0,0,0,0.36))]" />
            <div className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
              Face + Torso Guide
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PodiumPresetsControl({
  adjustments,
  hasTransparency,
  onAdjustmentChange,
  onResetAll,
  onResetLayout,
  previewUrl,
}: {
  adjustments: AthletePodiumPhotoAdjustments;
  hasTransparency?: boolean;
  onAdjustmentChange: (layoutMode: ExportLayoutMode, adjustment: ExportPhotoAdjustment) => void;
  onResetAll: () => void;
  onResetLayout: (layoutMode: ExportLayoutMode) => void;
  previewUrl: string;
}) {
  const [layoutMode, setLayoutMode] = useState<ExportLayoutMode>("podiumTop10");
  const adjustment = adjustments[layoutMode] ?? DEFAULT_EXPORT_PHOTO_ADJUSTMENTS[layoutMode];
  const compactZoomMin = 0.8;
  const zoomMin = isCompactExportLayoutMode(layoutMode) ? compactZoomMin : 1;
  const displayZoom = Math.max(zoomMin, adjustment.zoom);

  function updateAdjustment(patch: Partial<ExportPhotoAdjustment>) {
    onAdjustmentChange(layoutMode, clampExportPhotoAdjustment({ ...adjustment, ...patch }));
  }

  return (
    <section className="grid gap-4 rounded-[8px] border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Podium Presets</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
            Default crop for Story export layouts. Export preview can still override temporarily.
          </p>
        </div>
        <button
          className={buttonClassName("h-9 border border-zinc-200 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")}
          onClick={onResetAll}
          type="button"
        >
          Reset All
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STORY_EXPORT_LAYOUT_MODES.map((mode) => (
          <button
            aria-pressed={mode === layoutMode}
            className={cn(
              "h-10 rounded-[8px] border px-2 text-xs font-black transition",
              mode === layoutMode
                ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
            )}
            key={mode}
            onClick={() => setLayoutMode(mode)}
            type="button"
          >
            {STORY_EXPORT_LAYOUT_LABELS[mode]}
          </button>
        ))}
      </div>

      <PodiumPresetPreview adjustment={adjustment} hasTransparency={hasTransparency} layoutMode={layoutMode} previewUrl={previewUrl} />

      <div className="grid gap-3">
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center justify-between">
            Zoom <span className="font-mono">{displayZoom.toFixed(2)}x</span>
          </span>
          <input max="2.2" min={zoomMin} onChange={(event) => updateAdjustment({ zoom: Number(event.currentTarget.value) })} step="0.05" type="range" value={displayZoom} />
        </label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center justify-between">
            Horizontal <span className="font-mono">{Math.round(adjustment.x)}</span>
          </span>
          <input max="40" min="-40" onChange={(event) => updateAdjustment({ x: Number(event.currentTarget.value) })} step="1" type="range" value={adjustment.x} />
        </label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center justify-between">
            Vertical <span className="font-mono">{Math.round(adjustment.y)}</span>
          </span>
          <input max="40" min="-40" onChange={(event) => updateAdjustment({ y: Number(event.currentTarget.value) })} step="1" type="range" value={adjustment.y} />
        </label>
      </div>

      <button
        className={buttonClassName("h-9 border border-zinc-200 bg-white px-3 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")}
        onClick={() => onResetLayout(layoutMode)}
        type="button"
      >
        Reset {STORY_EXPORT_LAYOUT_LABELS[layoutMode]}
      </button>
    </section>
  );
}

function AthleteFormModal({
  form,
  normalizedPreview,
  onClose,
  onFileChange,
  onManualUrlChange,
  onNameChange,
  onPodiumAdjustmentChange,
  onPodiumAdjustmentResetAll,
  onPodiumAdjustmentResetLayout,
  onSave,
  onSportPodiumFileChange,
  onSportPodiumUrlChange,
  saving,
}: {
  form: AthleteFormState;
  normalizedPreview: string;
  onClose: () => void;
  onFileChange: (kind: AthleteImageKind, event: ChangeEvent<HTMLInputElement>) => void;
  onManualUrlChange: (kind: AthleteImageKind, value: string) => void;
  onNameChange: (value: string) => void;
  onPodiumAdjustmentChange: (layoutMode: ExportLayoutMode, adjustment: ExportPhotoAdjustment) => void;
  onPodiumAdjustmentResetAll: () => void;
  onPodiumAdjustmentResetLayout: (layoutMode: ExportLayoutMode) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSportPodiumFileChange: (key: SportPodiumPhotoKey, event: ChangeEvent<HTMLInputElement>) => void;
  onSportPodiumUrlChange: (key: SportPodiumPhotoKey, value: string) => void;
  saving: boolean;
}) {
  const profilePreviewUrl = form.profilePreviewUrl || form.profilePhotoUrl;
  const podiumPreviewUrl = form.podiumPreviewUrl || form.podiumPhotoUrl;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-primary-charcoal/50 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label={form.id ? "Update athlete" : "Create athlete"}
        aria-modal="true"
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-[8px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-zinc-950 dark:text-zinc-50">{form.id ? "Update Athlete" : "Create Athlete"}</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Crop images first, then save the athlete record.</p>
          </div>
          <button
            className="grid size-9 cursor-pointer place-items-center rounded-[8px] border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            title="Close athlete form"
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <form className="grid max-h-[78vh] overflow-y-auto" onSubmit={onSave}>
          <div className="grid gap-5 p-5">
            <label className="grid gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Name
              <input className={inputClassName()} onChange={(event) => onNameChange(event.target.value)} placeholder="Utha" value={form.name} />
            </label>

            <div className="rounded-[8px] bg-zinc-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.04em] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              normalized_name: <span className="text-zinc-950 dark:text-zinc-50">{normalizedPreview || "name required"}</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ImageUploadControl
                description="1:1 crop with a circular avatar frame."
                kind="profile"
                onFileChange={onFileChange}
                pending={Boolean(form.pendingProfileFile)}
                previewUrl={profilePreviewUrl}
              />
              <ImageUploadControl
                description="5:8 crop for the current Story podium export."
                kind="podium"
                onFileChange={onFileChange}
                pending={Boolean(form.pendingPodiumFile)}
                previewUrl={podiumPreviewUrl}
              />
            </div>

            <SportPodiumPhotoSlots
              defaultPreviewUrl={podiumPreviewUrl}
              onFileChange={onSportPodiumFileChange}
              onUrlChange={onSportPodiumUrlChange}
              pendingFiles={form.pendingSportPodiumFiles}
              previewUrls={form.sportPodiumPreviewUrls}
              sportPhotoUrls={form.sportPodiumPhotoUrls}
            />

            <PodiumPresetsControl
              adjustments={form.podiumPhotoAdjustments}
              hasTransparency={form.podiumPreviewHasTransparency}
              onAdjustmentChange={onPodiumAdjustmentChange}
              onResetAll={onPodiumAdjustmentResetAll}
              onResetLayout={onPodiumAdjustmentResetLayout}
              previewUrl={podiumPreviewUrl}
            />

            <details className="rounded-[8px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <summary className="cursor-pointer px-3 py-3 text-sm font-black text-zinc-700 dark:text-zinc-200">Advanced URLs</summary>
              <div className="grid gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  className={inputClassName("text-xs")}
                  onChange={(event) => onManualUrlChange("profile", event.target.value)}
                  placeholder="Profile photo URL"
                  value={form.profilePhotoUrl}
                />
                <input
                  className={inputClassName("text-xs")}
                  onChange={(event) => onManualUrlChange("podium", event.target.value)}
                  placeholder="Story podium image URL"
                  value={form.podiumPhotoUrl}
                />
              </div>
            </details>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <button className={buttonClassName("border border-zinc-200 bg-white px-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={buttonClassName("bg-zinc-950 px-4 text-white dark:bg-zinc-50 dark:text-zinc-950")} disabled={saving} type="submit">
              <Check size={16} />
              {saving ? "Saving..." : form.id ? "Save Athlete" : "Create Athlete"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CropImageModal({
  onApply,
  onClose,
  onFrameChange,
  processing,
  session,
}: {
  onApply: () => void;
  onClose: () => void;
  onFrameChange: (frame: CropFrame) => void;
  processing: boolean;
  session: CropSession;
}) {
  const preset = ATHLETE_IMAGE_CROP_PRESETS[session.kind];
  const frame = session.frame;
  const maxX = Math.max(0, session.dimensions.width - frame.width);
  const maxY = Math.max(0, session.dimensions.height - frame.height);
  const baseFrame = centeredCropFrame(session.dimensions, preset.aspectRatio);
  const zoom = Math.max(1, Math.min(3, Number((baseFrame.width / frame.width).toFixed(2))));
  const backgroundPositionX = maxX ? `${(frame.x / maxX) * 100}%` : "50%";
  const backgroundPositionY = maxY ? `${(frame.y / maxY) * 100}%` : "50%";
  const previewStyle: CSSProperties = {
    aspectRatio: `${preset.outputWidth} / ${preset.outputHeight}`,
    backgroundImage: `url(${session.dataUrl})`,
    backgroundPosition: `${backgroundPositionX} ${backgroundPositionY}`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(session.dimensions.width / frame.width) * 100}% ${(session.dimensions.height / frame.height) * 100}%`,
  };

  function updateFrame(patch: Partial<CropFrame>) {
    onFrameChange(clampCropFrame({ ...frame, ...patch }, session.dimensions));
  }

  function updateZoom(nextZoom: number) {
    const centerX = frame.x + frame.width / 2;
    const centerY = frame.y + frame.height / 2;
    const nextWidth = Math.max(64, Math.round(baseFrame.width / nextZoom));
    const nextHeight = Math.max(64, Math.round(nextWidth / preset.aspectRatio));

    onFrameChange(
      clampCropFrame(
        {
          x: Math.round(centerX - nextWidth / 2),
          y: Math.round(centerY - nextHeight / 2),
          width: nextWidth,
          height: nextHeight,
        },
        session.dimensions,
      ),
    );
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/60 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label={`Crop ${preset.label}`}
        aria-modal="true"
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-[8px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-zinc-950 dark:text-zinc-50">Crop {preset.label}</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Output {preset.outputWidth}x{preset.outputHeight} WebP
            </p>
          </div>
          <button
            className="grid size-9 cursor-pointer place-items-center rounded-[8px] border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            title="Close crop"
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[78vh] gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="grid place-items-center rounded-[8px] border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div
              className={cn(
                "w-full max-w-[360px] overflow-hidden border-2 border-white shadow-[0_18px_44px_rgba(0,0,0,0.22)]",
                preset.frameClassName,
              )}
              style={previewStyle}
            />
          </div>

          <div className="grid content-start gap-4">
            <label className="grid gap-2 text-sm font-black text-zinc-700 dark:text-zinc-200">
              Zoom
              <input
                max="3"
                min="1"
                onChange={(event) => updateZoom(Number(event.target.value))}
                step="0.01"
                type="range"
                value={zoom}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-zinc-700 dark:text-zinc-200">
              Position X
              <input
                max={maxX}
                min="0"
                onChange={(event) => updateFrame({ x: Number(event.target.value) })}
                step="1"
                type="range"
                value={frame.x}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-zinc-700 dark:text-zinc-200">
              Position Y
              <input
                max={maxY}
                min="0"
                onChange={(event) => updateFrame({ y: Number(event.target.value) })}
                step="1"
                type="range"
                value={frame.y}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button className={buttonClassName("border border-zinc-200 bg-white px-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={buttonClassName("bg-zinc-950 px-4 text-white dark:bg-zinc-50 dark:text-zinc-950")} disabled={processing} onClick={onApply} type="button">
            <Crop size={16} />
            {processing ? "Cropping..." : "Apply Crop"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function AthleteDatabaseApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [athletes, setAthletes] = useState<AthleteRecord[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<AthleteFormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [cropSession, setCropSession] = useState<CropSession | null>(null);
  const [status, setStatus] = useState("Loading athletes");
  const [storageStatus, setStorageStatus] = useState("Checking storage buckets");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropProcessing, setCropProcessing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<AthleteImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<AthleteToast | null>(null);

  const normalizedPreview = useMemo(() => normalizeAthleteName(form.name), [form.name]);

  function showToast(message: string, tone: AthleteToast["tone"]) {
    setToast({ message, tone });
  }

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    return () => {
      revokeFormPreviews(form);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshAthletes(query = search) {
    setLoading(true);
    try {
      const rows = await listAthletes(query);
      setAthletes(rows);
      setStatus(rows.length ? `${rows.length} athlete${rows.length === 1 ? "" : "s"} loaded` : "No athletes found");
    } catch (error) {
      setStatus(`Could not load athletes: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStorageStatus() {
    try {
      const result = await validateAthleteStorage();
      if (result.created.length) {
        setStorageStatus(`Storage initialized: created ${result.created.join(", ")}`);
        return;
      }

      setStorageStatus(`Storage ready: ${result.found.join(", ")}`);
    } catch (error) {
      setStorageStatus(`Storage warning: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStorageStatus();
    void refreshAthletes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFormModal() {
    revokeFormPreviews(form);
    setForm(EMPTY_FORM);
    setCropSession(null);
    setFormOpen(false);
  }

  function openCreateModal() {
    revokeFormPreviews(form);
    setForm(EMPTY_FORM);
    setCropSession(null);
    setFormOpen(true);
  }

  function openEditModal(athlete: AthleteRecord) {
    revokeFormPreviews(form);
    setForm(formFromAthlete(athlete));
    setCropSession(null);
    setFormOpen(true);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAthletes(search);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      const message = "Nama atlet wajib diisi";
      setStatus(message);
      showToast(message, "error");
      return;
    }

    setSaving(true);
    try {
      let profilePhotoUrl = form.profilePhotoUrl;
      let podiumPhotoUrl = form.podiumPhotoUrl;
      const sportPodiumPhotoUrls: SportPodiumPhotoUrls = {
        ...form.sportPodiumPhotoUrls,
      };

      if (form.pendingProfileFile) {
        profilePhotoUrl = await uploadAthleteImage(form.pendingProfileFile, "athlete-profile");
      }

      if (form.pendingPodiumFile) {
        podiumPhotoUrl = await uploadAthleteImage(form.pendingPodiumFile, "athlete-podium");
      }

      for (const option of SPORT_PODIUM_PHOTO_OPTIONS) {
        const file = form.pendingSportPodiumFiles[option.key];
        if (file) {
          sportPodiumPhotoUrls[option.key] = await uploadAthleteImage(file, "athlete-podium");
        }
      }

      const payload = formPayload({
        ...form,
        profilePhotoUrl,
        podiumPhotoUrl,
        sportPodiumPhotoUrls,
      });

      if (form.id) {
        await updateAthleteRecord(form.id, payload);
        setStatus("Athlete updated");
      } else {
        await createAthlete(payload);
        setStatus("Athlete created");
      }
      showToast("Atlet berhasil disimpan", "success");
      clearAthleteLookupCache();
      resetFormModal();
      await refreshAthletes(search);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Could not save athlete: ${message}`);
      showToast(`Gagal menyimpan atlet: ${message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(athlete: AthleteRecord) {
    if (!window.confirm(`Delete ${athlete.name}?`)) {
      return;
    }

    try {
      await deleteAthleteRecord(athlete.id);
      clearAthleteLookupCache();
      setStatus(`${athlete.name} deleted`);
      await refreshAthletes(search);
    } catch (error) {
      setStatus(`Could not delete athlete: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleDownloadPhoto(athlete: AthleteRecord, kind: AthletePhotoKind) {
    const photoUrl = kind === "profile" ? athlete.profilePhotoUrl : athlete.podiumPhotoUrl;
    if (!photoUrl) {
      setStatus(`${kind === "profile" ? "Profile" : "Podium"} photo is not available for ${athlete.name}`);
      return;
    }

    try {
      setStatus(`Downloading ${kind === "profile" ? "profile" : "podium"} photo for ${athlete.name}`);
      await downloadAthletePhoto(athlete.id, kind);
      setStatus(`${kind === "profile" ? "Profile" : "Podium"} photo downloaded for ${athlete.name}`);
    } catch (error) {
      setStatus(`Could not download photo: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleImageSelection(kind: AthleteImageKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const preset = ATHLETE_IMAGE_CROP_PRESETS[kind];
      const loaded = await readImageFile(file);
      setCropSession({
        kind,
        file,
        image: loaded.image,
        dataUrl: loaded.dataUrl,
        dimensions: loaded.dimensions,
        frame: centeredCropFrame(loaded.dimensions, preset.aspectRatio),
      });
    } catch (error) {
      setStatus(`Could not load image: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function handleSportPodiumImageSelection(key: SportPodiumPhotoKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const preset = ATHLETE_IMAGE_CROP_PRESETS.podium;
      const loaded = await readImageFile(file);
      setCropSession({
        kind: "podium",
        sportPodiumPhotoKey: key,
        file,
        image: loaded.image,
        dataUrl: loaded.dataUrl,
        dimensions: loaded.dimensions,
        frame: centeredCropFrame(loaded.dimensions, preset.aspectRatio),
      });
    } catch (error) {
      setStatus(`Could not load image: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function applyCropSelection() {
    if (!cropSession) {
      return;
    }

    setCropProcessing(true);
    try {
      const preset = ATHLETE_IMAGE_CROP_PRESETS[cropSession.kind];
      const cropped = await cropImageFile(cropSession.file, cropSession.image, cropSession.frame, preset);

      setForm((current) => {
        if (cropSession.sportPodiumPhotoKey) {
          const key = cropSession.sportPodiumPhotoKey;
          revokePreviewUrl(current.sportPodiumPreviewUrls[key] ?? "");
          return {
            ...current,
            pendingSportPodiumFiles: {
              ...current.pendingSportPodiumFiles,
              [key]: cropped.file,
            },
            sportPodiumPreviewUrls: {
              ...current.sportPodiumPreviewUrls,
              [key]: cropped.previewUrl,
            },
          };
        }

        if (cropSession.kind === "profile") {
          revokePreviewUrl(current.profilePreviewUrl);
          return {
            ...current,
            profilePreviewUrl: cropped.previewUrl,
            pendingProfileFile: cropped.file,
          };
        }

        revokePreviewUrl(current.podiumPreviewUrl);
        return {
          ...current,
          podiumPreviewUrl: cropped.previewUrl,
          podiumPreviewHasTransparency: cropped.hasTransparency,
          pendingPodiumFile: cropped.file,
        };
      });
      setCropSession(null);
      setStatus(`${preset.label} cropped. Save athlete to upload.`);
    } catch (error) {
      setStatus(`Could not crop image: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setCropProcessing(false);
    }
  }

  function handleManualUrlChange(kind: AthleteImageKind, value: string) {
    setForm((current) => {
      if (kind === "profile") {
        revokePreviewUrl(current.profilePreviewUrl);
        return {
          ...current,
          profilePhotoUrl: value,
          profilePreviewUrl: "",
          pendingProfileFile: undefined,
        };
      }

      revokePreviewUrl(current.podiumPreviewUrl);
      return {
        ...current,
        podiumPhotoUrl: value,
        podiumPreviewUrl: "",
        podiumPreviewHasTransparency: undefined,
        pendingPodiumFile: undefined,
      };
    });
  }

  function handleSportPodiumUrlChange(key: SportPodiumPhotoKey, value: string) {
    setForm((current) => {
      revokePreviewUrl(current.sportPodiumPreviewUrls[key] ?? "");
      const nextUrls = { ...current.sportPodiumPhotoUrls, [key]: value };
      const nextPreviewUrls = { ...current.sportPodiumPreviewUrls };
      const nextPendingFiles = { ...current.pendingSportPodiumFiles };
      delete nextPreviewUrls[key];
      delete nextPendingFiles[key];

      return {
        ...current,
        pendingSportPodiumFiles: nextPendingFiles,
        sportPodiumPhotoUrls: nextUrls,
        sportPodiumPreviewUrls: nextPreviewUrls,
      };
    });
  }

  function handlePodiumAdjustmentChange(layoutMode: ExportLayoutMode, adjustment: ExportPhotoAdjustment) {
    setForm((current) => ({
      ...current,
      podiumPhotoAdjustments: {
        ...current.podiumPhotoAdjustments,
        [layoutMode]: clampExportPhotoAdjustment(adjustment),
      },
    }));
  }

  function handlePodiumAdjustmentResetLayout(layoutMode: ExportLayoutMode) {
    setForm((current) => {
      const nextAdjustments = { ...current.podiumPhotoAdjustments };
      delete nextAdjustments[layoutMode];
      return {
        ...current,
        podiumPhotoAdjustments: nextAdjustments,
      };
    });
  }

  function handlePodiumAdjustmentResetAll() {
    setForm((current) => ({
      ...current,
      podiumPhotoAdjustments: {},
    }));
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseAthleteImportCsv(text);
      setImportRows(rows);
      setImportError(rows.length ? "" : "No valid athlete names found.");
    } catch (error) {
      setImportRows([]);
      setImportError(`Could not parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function handleImportAthletes() {
    if (!importRows.length) {
      setImportError("No valid athlete names found.");
      return;
    }

    setImporting(true);
    try {
      const summary = await importAthletes(importRows.map((row) => row.name));
      clearAthleteLookupCache();
      setImportOpen(false);
      setImportRows([]);
      setImportError("");
      await refreshAthletes(search);
      setStatus(`${summary.created} athletes imported successfully`);
    } catch (error) {
      setImportError(`Could not import athletes: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className={embedded ? "bg-transparent text-zinc-950 dark:text-gray-100" : "min-h-screen bg-[#f3f4f1] px-5 py-6 text-zinc-950"}>
      {toast ? (
        <div
          aria-live="polite"
          className={cn(
            "fixed bottom-5 left-5 right-5 z-[120] rounded-[8px] border px-4 py-3 text-sm font-black shadow-[0_18px_44px_rgba(0,0,0,0.16)] sm:left-auto sm:max-w-md",
            toast.tone === "success"
              ? "border-primary-green/25 bg-primary-green text-white"
              : "border-red-200 bg-red-600 text-white dark:border-red-900",
          )}
          data-testid="athlete-save-toast"
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      {importOpen ? (
        <ImportAthleteModal
          error={importError}
          importing={importing}
          onClose={() => {
            setImportOpen(false);
            setImportRows([]);
            setImportError("");
          }}
          onFileChange={(event) => void handleImportFile(event)}
          onImport={() => void handleImportAthletes()}
          rows={importRows}
        />
      ) : null}

      {formOpen ? (
            <AthleteFormModal
              form={form}
              normalizedPreview={normalizedPreview}
              onClose={resetFormModal}
              onFileChange={(kind, event) => void handleImageSelection(kind, event)}
              onManualUrlChange={handleManualUrlChange}
              onNameChange={(name) => setForm((current) => ({ ...current, name }))}
              onPodiumAdjustmentChange={handlePodiumAdjustmentChange}
              onPodiumAdjustmentResetAll={handlePodiumAdjustmentResetAll}
              onPodiumAdjustmentResetLayout={handlePodiumAdjustmentResetLayout}
              onSave={(event) => void handleSave(event)}
              onSportPodiumFileChange={(key, event) => void handleSportPodiumImageSelection(key, event)}
              onSportPodiumUrlChange={handleSportPodiumUrlChange}
              saving={saving}
            />
      ) : null}

      {cropSession ? (
        <CropImageModal
          onApply={() => void applyCropSelection()}
          onClose={() => setCropSession(null)}
          onFrameChange={(frame) => setCropSession((current) => (current ? { ...current, frame } : current))}
          processing={cropProcessing}
          session={cropSession}
        />
      ) : null}

      <section className={cn("mx-auto grid w-full min-w-0 max-w-5xl gap-4", embedded ? "" : "min-h-screen content-start")}>
        <div className="min-w-0 rounded-[8px] border border-zinc-200 bg-white p-5 shadow-[0_18px_44px_rgba(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!embedded ? (
                  <Link
                    className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                    href="/admin?tab=athletes"
                    title="Back to admin"
                  >
                    <ArrowLeft size={17} />
                  </Link>
                ) : null}
                <div>
                  <h2 className="text-2xl font-black tracking-normal text-zinc-950 dark:text-zinc-50">Athlete Database</h2>
                  <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Auto-match CSV imports by normalized name.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                aria-label="Create athlete"
                className={buttonClassName("bg-zinc-950 px-4 text-white dark:bg-zinc-50 dark:text-zinc-950")}
                onClick={openCreateModal}
                type="button"
              >
                <Plus size={16} />
                Create Athlete
              </button>
              <button
                className={buttonClassName("border border-zinc-200 bg-white px-4 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200")}
                onClick={() => setImportOpen(true)}
                type="button"
              >
                <FileUp size={16} />
                Import CSV
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-2 text-sm font-semibold text-zinc-600 sm:grid-cols-2 dark:text-zinc-300">
            <div className="rounded-[8px] bg-zinc-50 px-3 py-2 dark:bg-zinc-900" role="status">
              {status}
            </div>
            <div className="rounded-[8px] bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {storageStatus}
            </div>
          </div>

          <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                className={inputClassName("pl-9")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search athlete"
                value={search}
              />
            </label>
            <button className={buttonClassName("bg-zinc-950 px-4 text-white dark:bg-zinc-50 dark:text-zinc-950")} disabled={loading} type="submit">
              Search
            </button>
          </form>

          <div className="w-full max-w-full overflow-x-auto rounded-[8px] border border-zinc-200 dark:border-zinc-800">
            <div className="min-w-[840px]">
              <div className="grid grid-cols-[64px_1fr_92px_156px_96px] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-[0.05em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <span>Avatar</span>
                <span>Name</span>
                <span>Podium</span>
                <span>Download</span>
                <span className="text-right">Actions</span>
              </div>
              {athletes.map((athlete) => (
                <div
                  className="grid grid-cols-[64px_1fr_92px_156px_96px] items-center gap-3 border-b border-zinc-100 px-4 py-4 last:border-b-0 dark:border-zinc-800"
                  key={athlete.id}
                >
                  <ProfilePreview athlete={athlete} />
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-zinc-950 dark:text-zinc-50">{athlete.name}</div>
                    <div className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{athlete.normalizedName}</div>
                  </div>
                  <PodiumPreview athlete={athlete} />
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={`Download ${athlete.name} profile photo`}
                      className="inline-flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      disabled={!athlete.profilePhotoUrl}
                      onClick={() => void handleDownloadPhoto(athlete, "profile")}
                      title={athlete.profilePhotoUrl ? `Download ${athlete.name} profile photo` : "No profile photo"}
                      type="button"
                    >
                      <Download size={13} />
                      <span>Profile</span>
                    </button>
                    <button
                      aria-label={`Download ${athlete.name} podium photo`}
                      className="inline-flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      disabled={!athlete.podiumPhotoUrl}
                      onClick={() => void handleDownloadPhoto(athlete, "podium")}
                      title={athlete.podiumPhotoUrl ? `Download ${athlete.name} podium photo` : "No podium photo"}
                      type="button"
                    >
                      <Download size={13} />
                      <span>Podium</span>
                    </button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="grid size-9 cursor-pointer place-items-center rounded-[8px] border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      onClick={() => openEditModal(athlete)}
                      title={`Edit ${athlete.name}`}
                      type="button"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      className="grid size-9 cursor-pointer place-items-center rounded-[8px] border border-zinc-200 bg-white text-red-600 transition hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/30"
                      onClick={() => void handleDelete(athlete)}
                      title={`Delete ${athlete.name}`}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {!athletes.length ? (
                <div className="px-4 py-12 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  {loading ? "Loading athletes..." : "No athletes yet. Create one to enable automatic leaderboard images."}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
