"use client";

import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Check,
  ChevronDown,
  ChevronUp,
  Crop,
  Download,
  Dumbbell,
  Edit3,
  FileUp,
  Footprints,
  Image as ImageIcon,
  ImagePlus,
  Plus,
  Search,
  Star,
  Trash2,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createAthlete,
  deleteAthleteRecord,
  downloadAthletePhoto,
  downloadAthletePhotoUrl,
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
import type { AthletePodiumPhotoAdjustments } from "@/lib/leaderboard/types";
import { cn } from "@/lib/utils";
import { useModalA11y } from "@/hooks/useModalA11y";

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

type PhotoSlotKey = "main" | SportPodiumPhotoKey;
type PhotoSlotStatus = "custom" | "default" | "empty";

interface PhotoSlotDefinition {
  icon: LucideIcon;
  key: PhotoSlotKey;
  label: string;
  shortLabel: string;
}

interface PhotoCoverage {
  customCount: number;
  emptyCount: number;
  statusLabel: string;
  totalCount: number;
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

const PHOTO_SLOT_DEFINITIONS: PhotoSlotDefinition[] = [
  {
    icon: Star,
    key: "main",
    label: "Main podium",
    shortLabel: "Main",
  },
  {
    icon: Footprints,
    key: "running",
    label: "Running",
    shortLabel: "Run",
  },
  {
    icon: Bike,
    key: "cycling",
    label: "Cycling",
    shortLabel: "Bike",
  },
  {
    icon: Waves,
    key: "swimming",
    label: "Swimming",
    shortLabel: "Swim",
  },
  {
    icon: Dumbbell,
    key: "weight_training",
    label: "Weight training",
    shortLabel: "Gym",
  },
];

function inputClassName(extra?: string) {
  return cn(
    "min-h-11 w-full rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-medium text-primary-charcoal outline-none transition focus:border-primary-charcoal focus:ring-2 focus:ring-primary-brown/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-200",
    extra,
  );
}

function buttonClassName(extra?: string) {
  return cn(
    "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    extra,
  );
}

function formPayload(form: AthleteFormState): AthletePayload {
  return {
    name: form.name.trim(),
    podiumPhotoAdjustments: form.podiumPhotoAdjustments,
    profilePhotoUrl: form.profilePhotoUrl.trim() || null,
    podiumPhotoUrl: form.podiumPhotoUrl.trim() || null,
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
    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-brown text-sm font-black text-white dark:bg-secondary-sand/15 dark:text-white">
      {athlete.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={athlete.profilePhotoUrl} />
      ) : (
        initialsForName(athlete.name)
      )}
    </div>
  );
}

function photoSlotPreviewUrl(athlete: AthleteRecord, key: PhotoSlotKey): string | undefined {
  if (key === "main") {
    return athlete.podiumPhotoUrl;
  }

  return athlete.sportPodiumPhotoUrls?.[key] || athlete.podiumPhotoUrl;
}

function photoSlotStatus(athlete: AthleteRecord, key: PhotoSlotKey): PhotoSlotStatus {
  if (key === "main") {
    return athlete.podiumPhotoUrl ? "custom" : "empty";
  }

  if (athlete.sportPodiumPhotoUrls?.[key]) {
    return "custom";
  }

  return athlete.podiumPhotoUrl ? "default" : "empty";
}

function photoCoverageForAthlete(athlete: AthleteRecord): PhotoCoverage {
  const statuses = PHOTO_SLOT_DEFINITIONS.map((slot) => photoSlotStatus(athlete, slot.key));
  const customCount = statuses.filter((status) => status === "custom").length;
  const emptyCount = statuses.filter((status) => status === "empty").length;
  const totalCount = statuses.length;
  let statusLabel = `${customCount}/${totalCount} custom`;

  if (customCount === 0) {
    statusLabel = "No photos";
  } else if (customCount === totalCount) {
    statusLabel = "All custom";
  } else if (customCount === 1 && Boolean(athlete.podiumPhotoUrl) && emptyCount === 0) {
    statusLabel = "Default only";
  }

  return {
    customCount,
    emptyCount,
    statusLabel,
    totalCount,
  };
}

function statusLabelForSlot(status: PhotoSlotStatus) {
  if (status === "custom") {
    return "Custom";
  }

  if (status === "default") {
    return "Default";
  }

  return "Empty";
}

function AthletePhotoSummary({ athlete }: { athlete: AthleteRecord }) {
  const coverage = photoCoverageForAthlete(athlete);

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.04em]",
        coverage.customCount ? "bg-primary-green/12 text-primary-green" : "bg-secondary-sand/30 text-primary-charcoal/55 dark:bg-zinc-900 dark:text-gray-400",
      )}
      title={`${coverage.customCount}/${coverage.totalCount} foto custom · klik chevron untuk detail`}
    >
      <ImageIcon size={13} />
      {coverage.statusLabel}
    </span>
  );
}

function AthleteDetailDrawer({
  athlete,
  onManage,
}: {
  athlete: AthleteRecord;
  onManage: () => void;
}) {
  const coverage = photoCoverageForAthlete(athlete);

  return (
    <div
      className="grid gap-4 border-t border-secondary-sand/40 bg-secondary-sand/15 p-4 md:grid-cols-[120px_minmax(0,1fr)_auto] dark:border-zinc-800 dark:bg-zinc-900/35"
      data-testid="athlete-detail-drawer"
    >
      <div className="grid gap-2">
        <div className="grid h-36 w-full max-w-28 place-items-center overflow-hidden rounded-xl border border-secondary-sand/70 bg-white text-xs font-black text-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-950">
          {athlete.podiumPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${athlete.name} main podium preview`} className="h-full w-full object-cover object-center" src={athlete.podiumPhotoUrl} />
          ) : (
            <ImageIcon size={24} />
          )}
        </div>
        <span className="text-xs font-black text-primary-charcoal/70 dark:text-gray-300">Main podium</span>
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.08em] text-primary-charcoal/70 dark:text-gray-300">Photo coverage</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary-charcoal/70 ring-1 ring-secondary-sand/70 dark:bg-zinc-950 dark:text-gray-300 dark:ring-zinc-800">
            {coverage.statusLabel}
          </span>
          <span className="text-[11px] font-bold text-primary-charcoal/70 dark:text-gray-300">Custom / Default / Empty</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {PHOTO_SLOT_DEFINITIONS.map((slot) => {
            const status = photoSlotStatus(athlete, slot.key);
            const previewUrl = photoSlotPreviewUrl(athlete, slot.key);
            const Icon = slot.icon;

            return (
              <div className="min-w-0 rounded-xl border border-secondary-sand/70 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950" key={slot.key}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-black text-primary-charcoal dark:text-gray-100">{slot.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.04em]",
                      status === "custom" && "bg-primary-green/12 text-primary-green",
                      status === "default" && "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200",
                      status === "empty" && "bg-secondary-sand/30 text-primary-charcoal/55 dark:bg-zinc-900 dark:text-gray-400",
                    )}
                  >
                    {statusLabelForSlot(status)}
                  </span>
                </div>
                <div className="grid h-20 place-items-center overflow-hidden rounded-xl border border-secondary-sand/40 bg-secondary-sand/20 text-primary-charcoal/40 dark:border-zinc-800 dark:bg-zinc-900">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`${athlete.name} ${slot.label} preview`} className="h-full w-full object-cover object-center" src={previewUrl} />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-start justify-end">
        <button className={buttonClassName("h-10 bg-primary-brown px-3 text-white dark:bg-primary-brown dark:text-white")} onClick={onManage} type="button">
          <Edit3 size={15} />
          Manage Photos
        </button>
      </div>
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
  const dialogRef = useModalA11y<HTMLElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-primary-charcoal/50 px-5 py-8 backdrop-blur-sm">
      <section
        aria-label="Import CSV"
        aria-modal="true"
        className="max-h-full w-full max-w-2xl overflow-hidden rounded-xl border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">Import CSV</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">Bulk create athletes by name. Photos stay empty.</p>
          </div>
          <button
            aria-label="Close import"
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5">
          <label className="grid min-h-36 cursor-pointer place-items-center rounded-xl border border-dashed border-secondary-sand bg-secondary-sand/20 px-4 text-center text-sm font-black text-primary-charcoal/85 transition hover:border-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300">
            <FileUp size={24} />
            <span>Drag CSV Here</span>
            <span className="text-xs font-semibold text-primary-charcoal/55 dark:text-gray-400">or Choose File</span>
            <input accept=".csv,text/csv" aria-label="Choose CSV file" className="sr-only" onChange={onFileChange} type="file" />
          </label>

          {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}

          {rows.length ? (
            <div className="grid gap-3">
              <div className="text-sm font-black text-primary-charcoal/85 dark:text-gray-300">{rows.length} athletes detected</div>
              <div className="max-h-64 overflow-auto rounded-xl border border-secondary-sand/70 dark:border-zinc-800">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-secondary-sand/20 text-xs font-black uppercase tracking-[0.05em] text-primary-charcoal/55 dark:bg-zinc-900 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row) => (
                      <tr className="border-t border-secondary-sand/40 dark:border-zinc-800" key={`${row.rowNumber}-${row.normalizedName}`}>
                        <td className="px-3 py-2 font-semibold text-primary-charcoal dark:text-gray-300">{row.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 ? <div className="text-xs font-semibold text-primary-charcoal/55 dark:text-gray-400">Showing first 100 names.</div> : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")}
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

function PhotoActionCard({
  canClear,
  canDownload,
  onClear,
  onDownload,
  onFileChange,
  pending,
  previewShape = "podium",
  previewUrl,
  title,
}: {
  canClear: boolean;
  canDownload: boolean;
  onClear: () => void;
  onDownload: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  pending: boolean;
  previewShape?: "podium" | "profile";
  previewUrl: string;
  title: string;
}) {
  const isProfile = previewShape === "profile";

  return (
    <div className="grid gap-3 rounded-xl border border-secondary-sand/70 bg-secondary-sand/20 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-primary-charcoal dark:text-gray-100">{title}</div>
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
            "grid shrink-0 place-items-center overflow-hidden border border-secondary-sand/70 bg-white text-xs font-black text-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-950",
            isProfile ? "size-20 rounded-full" : "h-28 w-[70px] rounded-xl",
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${title} preview`} className="h-full w-full object-cover object-center" src={previewUrl} />
          ) : (
            <ImagePlus size={20} />
          )}
        </div>
        <label className={buttonClassName("h-10 flex-1 border border-dashed border-secondary-sand bg-white px-3 text-primary-charcoal/85 hover:border-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")}>
          <Crop size={16} />
          Choose & Crop
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Choose ${title.toLowerCase()} file`}
            className="sr-only"
            onChange={onFileChange}
            type="file"
          />
        </label>
        <button
          aria-label={`${title} download`}
          className="grid size-10 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 bg-white text-primary-charcoal/85 transition hover:bg-secondary-sand/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300 dark:hover:bg-zinc-900"
          disabled={!canDownload}
          onClick={onDownload}
          title={`Download ${title}`}
          type="button"
        >
          <Download size={15} />
        </button>
        <button
          aria-label={`${title} delete`}
          className="grid size-10 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/30"
          disabled={!canClear}
          onClick={onClear}
          title={`Delete ${title}`}
          type="button"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function SportPodiumPhotoSlots({
  defaultPreviewUrl,
  onClear,
  onDownload,
  onFileChange,
  pendingFiles,
  previewUrls,
  sportPhotoUrls,
}: {
  defaultPreviewUrl: string;
  onClear: (key: SportPodiumPhotoKey) => void;
  onDownload: (key: SportPodiumPhotoKey) => void;
  onFileChange: (key: SportPodiumPhotoKey, event: ChangeEvent<HTMLInputElement>) => void;
  pendingFiles: Partial<Record<SportPodiumPhotoKey, File>>;
  previewUrls: Partial<Record<SportPodiumPhotoKey, string>>;
  sportPhotoUrls: SportPodiumPhotoUrls;
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-secondary-sand/70 bg-secondary-sand/20 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div>
        <h3 className="text-sm font-black text-primary-charcoal dark:text-gray-100">Sport Podium Photos</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SPORT_PODIUM_PHOTO_OPTIONS.map((option) => {
          const specificPreviewUrl = previewUrls[option.key] || sportPhotoUrls[option.key] || "";
          const previewUrl = specificPreviewUrl || defaultPreviewUrl;

          return (
            <PhotoActionCard
              canClear={Boolean(specificPreviewUrl)}
              canDownload={Boolean(previewUrl)}
              key={option.key}
              onClear={() => onClear(option.key)}
              onDownload={() => onDownload(option.key)}
              onFileChange={(event) => onFileChange(option.key, event)}
              pending={Boolean(pendingFiles[option.key])}
              previewUrl={previewUrl}
              title={option.label}
            />
          );
        })}
      </div>
    </section>
  );
}


function AthleteFormModal({
  form,
  normalizedPreview,
  onClose,
  onDownloadPhoto,
  onDownloadSportPodiumPhoto,
  onFileChange,
  onNameChange,
  onPhotoClear,
  onSave,
  onSportPodiumClear,
  onSportPodiumFileChange,
  saving,
}: {
  form: AthleteFormState;
  normalizedPreview: string;
  onClose: () => void;
  onDownloadPhoto: (kind: AthletePhotoKind) => void;
  onDownloadSportPodiumPhoto: (key: SportPodiumPhotoKey) => void;
  onFileChange: (kind: AthleteImageKind, event: ChangeEvent<HTMLInputElement>) => void;
  onNameChange: (value: string) => void;
  onPhotoClear: (kind: AthleteImageKind) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSportPodiumClear: (key: SportPodiumPhotoKey) => void;
  onSportPodiumFileChange: (key: SportPodiumPhotoKey, event: ChangeEvent<HTMLInputElement>) => void;
  saving: boolean;
}) {
  const profilePreviewUrl = form.profilePreviewUrl || form.profilePhotoUrl;
  const podiumPreviewUrl = form.podiumPreviewUrl || form.podiumPhotoUrl;
  const dialogRef = useModalA11y<HTMLElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-primary-charcoal/50 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label={form.id ? "Update athlete" : "Create athlete"}
        aria-modal="true"
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-xl border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">{form.id ? "Update Athlete" : "Create Athlete"}</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">Crop images first, then save the athlete record.</p>
          </div>
          <button
            aria-label="Close athlete form"
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <form className="grid max-h-[78vh] overflow-y-auto" onSubmit={onSave}>
          <div className="grid gap-5 p-5">
            <label className="grid gap-2 text-sm font-semibold text-primary-charcoal/85 dark:text-gray-300">
              Name
              <input className={inputClassName()} onChange={(event) => onNameChange(event.target.value)} placeholder="Utha" value={form.name} />
            </label>

            <div className="rounded-xl bg-secondary-sand/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.04em] text-primary-charcoal/55 dark:bg-zinc-900 dark:text-gray-400">
              normalized_name: <span className="text-primary-charcoal dark:text-white">{normalizedPreview || "name required"}</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <PhotoActionCard
                canClear={Boolean(profilePreviewUrl)}
                canDownload={Boolean(profilePreviewUrl)}
                onClear={() => onPhotoClear("profile")}
                onDownload={() => onDownloadPhoto("profile")}
                onFileChange={(event) => onFileChange("profile", event)}
                pending={Boolean(form.pendingProfileFile)}
                previewShape="profile"
                previewUrl={profilePreviewUrl}
                title="Profile"
              />
              <PhotoActionCard
                canClear={Boolean(podiumPreviewUrl)}
                canDownload={Boolean(podiumPreviewUrl)}
                onClear={() => onPhotoClear("podium")}
                onDownload={() => onDownloadPhoto("podium")}
                onFileChange={(event) => onFileChange("podium", event)}
                pending={Boolean(form.pendingPodiumFile)}
                previewUrl={podiumPreviewUrl}
                title="Main Podium"
              />
            </div>

            <SportPodiumPhotoSlots
              defaultPreviewUrl={podiumPreviewUrl}
              onClear={onSportPodiumClear}
              onDownload={onDownloadSportPodiumPhoto}
              onFileChange={onSportPodiumFileChange}
              pendingFiles={form.pendingSportPodiumFiles}
              previewUrls={form.sportPodiumPreviewUrls}
              sportPhotoUrls={form.sportPodiumPhotoUrls}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
            <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")} disabled={saving} type="submit">
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

  const dialogRef = useModalA11y<HTMLElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/60 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label={`Crop ${preset.label}`}
        aria-modal="true"
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-xl border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">Crop {preset.label}</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">
              Output {preset.outputWidth}x{preset.outputHeight} WebP
            </p>
          </div>
          <button
            aria-label="Close crop"
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[78vh] gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="grid place-items-center rounded-xl border border-secondary-sand/70 bg-secondary-sand/30 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div
              className={cn(
                "w-full max-w-[360px] overflow-hidden border-2 border-white shadow-[0_18px_44px_rgba(0,0,0,0.22)]",
                preset.frameClassName,
              )}
              style={previewStyle}
            />
          </div>

          <div className="grid content-start gap-4">
            <label className="grid gap-2 text-sm font-black text-primary-charcoal/85 dark:text-gray-300">
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
            <label className="grid gap-2 text-sm font-black text-primary-charcoal/85 dark:text-gray-300">
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
            <label className="grid gap-2 text-sm font-black text-primary-charcoal/85 dark:text-gray-300">
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

        <div className="flex justify-end gap-2 border-t border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")} disabled={processing} onClick={onApply} type="button">
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
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);

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

  async function handleDownloadCurrentPhoto(kind: AthletePhotoKind) {
    const photoUrl = kind === "profile" ? form.profilePreviewUrl || form.profilePhotoUrl : form.podiumPreviewUrl || form.podiumPhotoUrl;
    if (!form.id || !photoUrl) {
      setStatus(`${kind === "profile" ? "Profile" : "Podium"} photo is not available for ${form.name}`);
      return;
    }

    try {
      setStatus(`Downloading ${kind === "profile" ? "profile" : "podium"} photo for ${form.name}`);
      await downloadAthletePhoto(form.id, kind);
      setStatus(`${kind === "profile" ? "Profile" : "Podium"} photo downloaded for ${form.name}`);
    } catch (error) {
      setStatus(`Could not download photo: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleDownloadSportPodiumPhoto(key: SportPodiumPhotoKey) {
    const photoUrl = form.sportPodiumPreviewUrls[key] || form.sportPodiumPhotoUrls[key] || form.podiumPreviewUrl || form.podiumPhotoUrl;
    if (!photoUrl) {
      setStatus(`${key} podium photo is not available for ${form.name}`);
      return;
    }

    try {
      const filenamePrefix = normalizeAthleteName(form.name).replace(/\s+/g, "-") || "athlete";
      setStatus(`Downloading ${key} podium photo for ${form.name}`);
      await downloadAthletePhotoUrl(photoUrl, `${filenamePrefix}-${key}-podium.webp`);
      setStatus(`${key} podium photo downloaded for ${form.name}`);
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

  function handleClearPhoto(kind: AthleteImageKind) {
    setForm((current) => {
      if (kind === "profile") {
        revokePreviewUrl(current.profilePreviewUrl);
        return {
          ...current,
          profilePhotoUrl: "",
          profilePreviewUrl: "",
          pendingProfileFile: undefined,
        };
      }

      revokePreviewUrl(current.podiumPreviewUrl);
      return {
        ...current,
        podiumPhotoUrl: "",
        podiumPreviewUrl: "",
        podiumPreviewHasTransparency: undefined,
        pendingPodiumFile: undefined,
      };
    });
  }

  function handleClearSportPodiumPhoto(key: SportPodiumPhotoKey) {
    setForm((current) => {
      revokePreviewUrl(current.sportPodiumPreviewUrls[key] ?? "");
      const nextUrls = { ...current.sportPodiumPhotoUrls };
      const nextPreviewUrls = { ...current.sportPodiumPreviewUrls };
      const nextPendingFiles = { ...current.pendingSportPodiumFiles };
      delete nextUrls[key];
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
    <main className={embedded ? "bg-transparent text-primary-charcoal dark:text-gray-100" : "min-h-screen bg-[#f3f4f1] px-5 py-6 text-primary-charcoal"}>
      {toast ? (
        <div
          aria-live="polite"
          className={cn(
            "fixed bottom-5 left-5 right-5 z-[120] rounded-xl border px-4 py-3 text-sm font-black shadow-[0_18px_44px_rgba(0,0,0,0.16)] sm:left-auto sm:max-w-md",
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
              onDownloadPhoto={(kind) => void handleDownloadCurrentPhoto(kind)}
              onDownloadSportPodiumPhoto={(key) => void handleDownloadSportPodiumPhoto(key)}
              onFileChange={(kind, event) => void handleImageSelection(kind, event)}
              onNameChange={(name) => setForm((current) => ({ ...current, name }))}
              onPhotoClear={handleClearPhoto}
              onSave={(event) => void handleSave(event)}
              onSportPodiumClear={handleClearSportPodiumPhoto}
              onSportPodiumFileChange={(key, event) => void handleSportPodiumImageSelection(key, event)}
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
        <div className="min-w-0 rounded-xl border border-secondary-sand/70 bg-white p-5 shadow-[0_18px_44px_rgba(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!embedded ? (
                  <Link
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20"
                    href="/admin?tab=athletes"
                    title="Back to admin"
                  >
                    <ArrowLeft size={17} />
                  </Link>
                ) : null}
                <div>
                  <h2 className="text-2xl font-black tracking-normal text-primary-charcoal dark:text-white">Athlete Database</h2>
                  <p className="mt-1 text-sm font-medium text-primary-charcoal/55 dark:text-gray-400">Auto-match CSV imports by normalized name.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                aria-label="Create athlete"
                className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")}
                onClick={openCreateModal}
                type="button"
              >
                <Plus size={16} />
                Create Athlete
              </button>
              <button
                className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")}
                onClick={() => setImportOpen(true)}
                type="button"
              >
                <FileUp size={16} />
                Import CSV
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-2 text-sm font-semibold text-primary-charcoal/70 sm:grid-cols-2 dark:text-gray-300">
            <div className="rounded-xl bg-secondary-sand/20 px-3 py-2 dark:bg-zinc-900" role="status">
              {status}
            </div>
            <div className="rounded-xl bg-secondary-sand/20 px-3 py-2 text-xs font-bold text-primary-charcoal/55 dark:bg-zinc-900 dark:text-gray-400">
              {storageStatus}
            </div>
          </div>

          <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-charcoal/40" />
              <input
                className={inputClassName("pl-9")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search athlete"
                value={search}
              />
            </label>
            <button className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")} disabled={loading} type="submit">
              Search
            </button>
          </form>

          <div className="grid gap-2" data-testid="athlete-database-list">
            {athletes.map((athlete) => {
              const isExpanded = expandedAthleteId === athlete.id;

              return (
                <article
                  className={cn(
                    "overflow-hidden rounded-xl border border-secondary-sand/70 bg-white transition dark:border-zinc-800 dark:bg-zinc-950",
                    isExpanded && "border-primary-green/30 shadow-[0_16px_34px_rgba(90,46,23,0.08)]",
                  )}
                  key={athlete.id}
                >
                  <div className="grid gap-3 p-4 md:grid-cols-[56px_minmax(0,1fr)_minmax(120px,160px)_132px] md:items-center">
                    <ProfilePreview athlete={athlete} />
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-primary-charcoal dark:text-white">{athlete.name}</div>
                      <div className="mt-1 truncate font-mono text-xs text-primary-charcoal/55 dark:text-gray-400">{athlete.normalizedName}</div>
                    </div>
                    <AthletePhotoSummary athlete={athlete} />
                    <div className="flex justify-start gap-2 md:justify-end">
                      {isExpanded ? (
                        <button
                          aria-label={`Collapse ${athlete.name} photo details`}
                          className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 bg-white text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300 dark:hover:bg-zinc-900"
                          onClick={() => setExpandedAthleteId(null)}
                          title={`Collapse ${athlete.name} photo details`}
                          type="button"
                        >
                          <ChevronUp size={15} />
                        </button>
                      ) : (
                        <button
                          aria-label={`Expand ${athlete.name} photo details`}
                          className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 bg-white text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300 dark:hover:bg-zinc-900"
                          onClick={() => setExpandedAthleteId(athlete.id)}
                          title={`Expand ${athlete.name} photo details`}
                          type="button"
                        >
                          <ChevronDown size={15} />
                        </button>
                      )}
                      <button
                        aria-label={`Edit ${athlete.name}`}
                        className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 bg-white text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300 dark:hover:bg-zinc-900"
                        onClick={() => openEditModal(athlete)}
                        title={`Edit ${athlete.name}`}
                        type="button"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        aria-label={`Delete ${athlete.name}`}
                        className="grid size-9 cursor-pointer place-items-center rounded-xl border border-secondary-sand/70 bg-white text-red-600 transition hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/30"
                        onClick={() => void handleDelete(athlete)}
                        title={`Delete ${athlete.name}`}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {isExpanded ? <AthleteDetailDrawer athlete={athlete} onManage={() => openEditModal(athlete)} /> : null}
                </article>
              );
            })}
            {!athletes.length ? (
              <div className="rounded-xl border border-secondary-sand/70 px-4 py-12 text-center text-sm font-semibold text-primary-charcoal/55 dark:border-zinc-800 dark:text-gray-400">
                {loading ? "Loading athletes..." : "No athletes yet. Create one to enable automatic leaderboard images."}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
