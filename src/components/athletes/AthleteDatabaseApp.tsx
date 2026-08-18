"use client";

import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Camera,
  Check,
  Crop,
  Download,
  Dumbbell,
  Edit3,
  Eye,
  EyeOff,
  FileUp,
  Footprints,
  ImagePlus,
  KeyRound,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
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
  listAthleteRoles,
  listAthletes,
  resetAthletePassword,
  updateAthleteAccount,
  updateAthleteRole,
  updateAthleteRecord,
  uploadAthleteImage,
  validateAthleteStorage,
  type AthleteRoleRecord,
  type AthletePayload,
} from "@/lib/athletes/api";
import { clearAthleteLookupCache } from "@/lib/athletes/client-cache";
import {
  ATHLETE_IMAGE_CROP_PRESETS,
  ATHLETE_IMAGE_CROP_ZOOM_LIMITS,
  centeredCropFrame,
  clampZoomableCropFrame,
  cropImageFile,
  cropFrameOffsetLimits,
  cropFrameForZoom,
  cropFrameImagePlacement,
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
import type { AuthRole } from "@/lib/auth/roles";
import { deriveUsernameFromAthleteName } from "@/lib/auth/username";
import { initialsForName } from "@/lib/leaderboard/images";
import type { AthletePodiumPhotoAdjustments } from "@/lib/leaderboard/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useModalA11y } from "@/hooks/useModalA11y";
import { cn } from "@/lib/utils";

interface AthleteFormState {
  id?: string;
  name: string;
  username?: string;
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

type PhotoSlotKey = "profile" | "main" | SportPodiumPhotoKey;
type PhotoSlotStatus = "ready" | "shared" | "missing";

interface PhotoSlotDefinition {
  icon: LucideIcon;
  key: PhotoSlotKey;
  label: string;
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

const PASSWORD_MIN_LENGTH = 6;

const PHOTO_SLOT_DEFINITIONS: PhotoSlotDefinition[] = [
  { icon: UserRound, key: "profile", label: "Foto profil" },
  { icon: Star, key: "main", label: "Foto podium" },
  { icon: Footprints, key: "running", label: "Lari" },
  { icon: Bike, key: "cycling", label: "Sepeda" },
  { icon: Waves, key: "swimming", label: "Renang" },
  { icon: Dumbbell, key: "weight_training", label: "Latihan beban" },
];

const ACCOUNT_ROLE_OPTIONS: Array<{ icon: LucideIcon; label: string; role: AuthRole }> = [
  { icon: UserRound, label: "Anggota", role: "user" },
  { icon: ShieldCheck, label: "Admin", role: "admin" },
];

function inputClassName(extra?: string) {
  return cn(
    "min-h-11 w-full rounded-lg border border-secondary-sand/70 bg-white px-3 text-sm font-medium text-primary-charcoal outline-none transition placeholder:text-primary-charcoal/35 focus:border-primary-charcoal focus:ring-2 focus:ring-primary-brown/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-200",
    extra,
  );
}

function buttonClassName(extra?: string) {
  return cn(
    "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
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
    username: athlete.username,
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

function displayUsername(athlete: Pick<AthleteRecord, "username">): string {
  return athlete.username ? `@${athlete.username.replace(/^@/, "")}` : "Belum ada username";
}

function accountStatusText(athlete: AthleteRecord): string {
  return athlete.authUserId ? "Aktif" : "Belum terhubung";
}

function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : "";
  const normalizedMessage = message.toLowerCase();
  if (message === "Login required.") {
    return "Sesi admin berakhir. Silakan login ulang.";
  }

  if (message === "Admin access required.") {
    return "Akses admin diperlukan untuk menyimpan perubahan.";
  }

  if (message === "Upload an image file.") {
    return "Pilih file gambar untuk diunggah.";
  }

  if (message === "Athlete photos must be PNG, JPEG, or WebP files.") {
    return "Foto harus berupa PNG, JPEG, atau WebP.";
  }

  if (message === "Image file is too large.") {
    return "Ukuran foto terlalu besar setelah dipotong.";
  }

  if (message.startsWith("Bucket \"") || message.startsWith("Supabase migration missing:")) {
    return message;
  }

  if (
    message === "Akun anggota belum tersedia." ||
    (normalizedMessage.includes("auth") && (normalizedMessage.includes("akun") || normalizedMessage.includes("atlet")))
  ) {
    return "Akun anggota belum siap dipakai.";
  }

  if (
    message.startsWith("Username sudah digunakan") ||
    message === "Username tidak boleh kosong." ||
    message === "Tidak ada perubahan akun untuk disimpan." ||
    message === "Admin tidak bisa menurunkan role akun sendiri." ||
    message === "Minimal harus ada satu admin aktif."
  ) {
    return message;
  }

  return fallback;
}

function replaceAthleteRecord(athletes: AthleteRecord[], updated: AthleteRecord): AthleteRecord[] {
  return athletes.map((athlete) => (athlete.id === updated.id ? updated : athlete));
}

function replaceAthleteRoleRecord(roles: AthleteRoleRecord[], updated: AthleteRoleRecord): AthleteRoleRecord[] {
  if (roles.some((role) => role.id === updated.id)) {
    return roles.map((role) => (role.id === updated.id ? updated : role));
  }

  return [...roles, updated].sort((a, b) => a.name.localeCompare(b.name));
}

function sportPhotoLabel(key: SportPodiumPhotoKey): string {
  return PHOTO_SLOT_DEFINITIONS.find((slot) => slot.key === key)?.label ?? key;
}

function ProfilePreview({ athlete, size = "md" }: { athlete: AthleteRecord; size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-brown text-sm font-black text-white dark:bg-secondary-sand/15 dark:text-white",
        size === "lg" ? "size-20 text-xl" : "size-12",
      )}
    >
      {athlete.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={athlete.profilePhotoUrl} />
      ) : (
        initialsForName(athlete.name)
      )}
    </div>
  );
}

function photoSlotStatus(athlete: AthleteRecord, key: PhotoSlotKey): PhotoSlotStatus {
  if (key === "profile") {
    return athlete.profilePhotoUrl ? "ready" : "missing";
  }

  if (key === "main") {
    return athlete.podiumPhotoUrl ? "ready" : "missing";
  }

  if (athlete.sportPodiumPhotoUrls?.[key]) {
    return "ready";
  }

  return athlete.podiumPhotoUrl ? "shared" : "missing";
}

function statusLabelForSlot(status: PhotoSlotStatus) {
  if (status === "ready") {
    return "Siap";
  }

  if (status === "shared") {
    return "Mengikuti foto podium";
  }

  return "Belum ada";
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-primary-charcoal/45 dark:text-gray-500">{label}</dt>
      <dd className="text-sm font-semibold text-primary-charcoal dark:text-gray-100">{value}</dd>
    </div>
  );
}

function PhotoStatusLine({ athlete, slot }: { athlete: AthleteRecord; slot: PhotoSlotDefinition }) {
  const status = photoSlotStatus(athlete, slot.key);
  const Icon = slot.icon;

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2">
      <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-primary-charcoal/82 dark:text-gray-200">
        <Icon className="size-4 shrink-0 text-primary-charcoal/45 dark:text-gray-500" />
        <span className="truncate">{slot.label}</span>
      </span>
      <span className="shrink-0 text-xs font-bold text-primary-charcoal/55 dark:text-gray-400">{statusLabelForSlot(status)}</span>
    </div>
  );
}

function MemberDetailDrawer({
  athlete,
  onClose,
  onEdit,
  onManageAccount,
  onManagePhotos,
}: {
  athlete: AthleteRecord;
  onClose: () => void;
  onEdit: () => void;
  onManageAccount: () => void;
  onManagePhotos: () => void;
}) {
  const dialogRef = useModalA11y<HTMLElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-[80]" data-testid="member-detail-drawer">
      <button
        aria-label="Tutup detail anggota"
        className="absolute inset-0 bg-primary-charcoal/32 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Detail anggota"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-hidden border-l border-secondary-sand/70 bg-white shadow-[0_24px_70px_rgb(31,31,31,0.18)] dark:border-zinc-800 dark:bg-zinc-950 sm:w-[440px]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-white">Detail anggota</h2>
          </div>
          <button
            aria-label="Tutup detail anggota"
            className="grid size-9 place-items-center rounded-lg border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid gap-6 overflow-y-auto px-5 py-6">
          <div className="grid justify-items-center gap-3 text-center">
            <ProfilePreview athlete={athlete} size="lg" />
            <div className="min-w-0">
              <h3 className="truncate font-poppins text-2xl font-black text-primary-charcoal dark:text-white">{athlete.name}</h3>
              <p className="mt-1 truncate text-sm font-bold text-primary-brown dark:text-secondary-sand">{displayUsername(athlete)}</p>
            </div>
          </div>

          <section className="grid gap-4 border-t border-secondary-sand/60 pt-5 dark:border-zinc-800">
            <h4 className="font-poppins text-sm font-black text-primary-charcoal dark:text-white">Data anggota</h4>
            <dl className="grid gap-4">
              <DetailItem label="Nama" value={athlete.name} />
              <DetailItem label="Username" value={displayUsername(athlete)} />
              <div className="grid gap-1">
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-primary-charcoal/45 dark:text-gray-500">Akun</dt>
                <dd className="inline-flex items-center gap-2 text-sm font-semibold text-primary-charcoal dark:text-gray-100">
                  <span className={cn("size-2 rounded-full", athlete.authUserId ? "bg-primary-green" : "bg-primary-charcoal/30")} />
                  {accountStatusText(athlete)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-3 border-t border-secondary-sand/60 pt-5 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-poppins text-sm font-black text-primary-charcoal dark:text-white">Foto anggota</h4>
              <button className={buttonClassName("h-9 border border-secondary-sand/70 bg-white px-3 text-primary-charcoal/80 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onManagePhotos} type="button">
                <Camera size={15} />
                Kelola foto
              </button>
            </div>
            <div className="divide-y divide-secondary-sand/50 dark:divide-zinc-800">
              {PHOTO_SLOT_DEFINITIONS.map((slot) => (
                <PhotoStatusLine athlete={athlete} key={slot.key} slot={slot} />
              ))}
            </div>
          </section>

          <section className="grid gap-3 border-t border-secondary-sand/60 pt-5 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-poppins text-sm font-black text-primary-charcoal dark:text-white">Akun & akses</h4>
              <button className={buttonClassName("h-9 border border-secondary-sand/70 bg-white px-3 text-primary-charcoal/80 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onManageAccount} type="button">
                <KeyRound size={15} />
                Kelola akun
              </button>
            </div>
            <p className="text-sm font-medium leading-6 text-primary-charcoal/62 dark:text-gray-400">
              Username, password, dan peran akun dikelola terpisah dari data profil.
            </p>
          </section>
        </div>

        <div className="mt-auto border-t border-secondary-sand/70 p-5 dark:border-zinc-800">
          <button className={buttonClassName("w-full bg-primary-brown px-4 text-white")} onClick={onEdit} type="button">
            <Edit3 size={16} />
            Edit anggota
          </button>
        </div>
      </aside>
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
        aria-label="Import anggota"
        aria-modal="true"
        className="max-h-full w-full max-w-2xl overflow-hidden rounded-lg border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">Import anggota</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">Unggah file CSV untuk menambahkan atau memperbarui data anggota.</p>
          </div>
          <button
            aria-label="Tutup import anggota"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5">
          <label className="grid min-h-36 cursor-pointer place-items-center rounded-lg border border-dashed border-secondary-sand bg-secondary-sand/20 px-4 text-center text-sm font-black text-primary-charcoal/85 transition hover:border-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300">
            <FileUp size={24} />
            <span>Pilih file CSV</span>
            <span className="text-xs font-semibold text-primary-charcoal/55 dark:text-gray-400">Nama anggota akan dibaca dari file.</span>
            <input accept=".csv,text/csv" aria-label="Pilih file CSV" className="sr-only" onChange={onFileChange} type="file" />
          </label>

          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}

          {rows.length ? (
            <div className="grid gap-3">
              <div className="text-sm font-black text-primary-charcoal/85 dark:text-gray-300">{rows.length} anggota siap diproses</div>
              <div className="max-h-64 overflow-auto rounded-lg border border-secondary-sand/70 dark:border-zinc-800">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-secondary-sand/20 text-xs font-black uppercase tracking-[0.05em] text-primary-charcoal/55 dark:bg-zinc-900 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Username</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row) => (
                      <tr className="border-t border-secondary-sand/40 dark:border-zinc-800" key={`${row.rowNumber}-${row.normalizedName}`}>
                        <td className="px-3 py-2 font-semibold text-primary-charcoal dark:text-gray-300">{row.name}</td>
                        <td className="px-3 py-2 text-xs font-bold text-primary-brown dark:text-secondary-sand">
                          @{deriveUsernameFromAthleteName(row.name)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 ? <div className="text-xs font-semibold text-primary-charcoal/55 dark:text-gray-400">Menampilkan 100 nama pertama.</div> : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onClose} type="button">
            Batal
          </button>
          <button
            className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")}
            disabled={!rows.length || importing}
            onClick={onImport}
            type="button"
          >
            {importing ? "Memproses..." : "Import"}
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
    <div className="grid gap-3 rounded-lg border border-secondary-sand/70 bg-secondary-sand/16 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-primary-charcoal dark:text-gray-100">{title}</div>
        {pending ? (
          <span className="rounded-full bg-primary-green/12 px-2 py-1 text-[11px] font-black uppercase tracking-[0.04em] text-primary-green dark:bg-secondary-teal/15 dark:text-secondary-teal">
            Siap disimpan
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden border border-secondary-sand/70 bg-white text-xs font-black text-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-950",
            isProfile ? "size-20 rounded-full" : "h-28 w-[70px] rounded-lg",
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
          Pilih & potong
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Pilih ${title.toLowerCase()}`}
            className="sr-only"
            onChange={onFileChange}
            type="file"
          />
        </label>
        <button
          aria-label={`Unduh ${title}`}
          className="grid size-10 cursor-pointer place-items-center rounded-lg border border-secondary-sand/70 bg-white text-primary-charcoal/85 transition hover:bg-secondary-sand/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300 dark:hover:bg-zinc-900"
          disabled={!canDownload}
          onClick={onDownload}
          title={`Unduh ${title}`}
          type="button"
        >
          <Download size={15} />
        </button>
        <button
          aria-label={`Hapus ${title}`}
          className="grid size-10 cursor-pointer place-items-center rounded-lg border border-secondary-sand/70 bg-white text-red-600/80 transition hover:bg-secondary-sand/20 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-red-300/80 dark:hover:bg-zinc-900"
          disabled={!canClear}
          onClick={onClear}
          title={`Hapus ${title}`}
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
    <section className="grid gap-3 rounded-lg border border-secondary-sand/70 bg-secondary-sand/16 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div>
        <h3 className="text-sm font-black text-primary-charcoal dark:text-gray-100">Foto kegiatan</h3>
        <p className="mt-1 text-xs font-semibold text-primary-charcoal/55 dark:text-gray-400">Gunakan foto khusus per cabang jika diperlukan.</p>
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
              title={sportPhotoLabel(option.key)}
            />
          );
        })}
      </div>
    </section>
  );
}

function AthleteFormModal({
  form,
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
  usernamePreview,
}: {
  form: AthleteFormState;
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
  usernamePreview: string;
}) {
  const profilePreviewUrl = form.profilePreviewUrl || form.profilePhotoUrl;
  const podiumPreviewUrl = form.podiumPreviewUrl || form.podiumPhotoUrl;
  const dialogRef = useModalA11y<HTMLElement>(true, onClose);
  const title = form.id ? "Edit anggota" : "Tambah anggota";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-primary-charcoal/50 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label={title}
        aria-modal="true"
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-lg border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">{title}</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">Simpan data profil dan foto anggota.</p>
          </div>
          <button
            aria-label="Tutup formulir anggota"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <form className="grid max-h-[78vh] overflow-y-auto" onSubmit={onSave}>
          <div className="grid gap-5 p-5">
            <section className="grid gap-3">
              <h3 className="font-poppins text-sm font-black text-primary-charcoal dark:text-gray-100">Data anggota</h3>
              <label className="grid gap-2 text-sm font-semibold text-primary-charcoal/85 dark:text-gray-300">
                Nama
                <input className={inputClassName()} onChange={(event) => onNameChange(event.target.value)} placeholder="Nama anggota" value={form.name} />
              </label>
              <div className="rounded-lg bg-secondary-sand/18 px-3 py-2 text-xs font-semibold leading-5 text-primary-charcoal/62 dark:bg-zinc-900 dark:text-gray-400">
                {form.id ? "Username dikelola dari panel Akun & akses." : `Username awal: @${usernamePreview || "nama.anggota"}`}
              </div>
            </section>

            <section className="grid gap-3">
              <h3 className="font-poppins text-sm font-black text-primary-charcoal dark:text-gray-100">Foto anggota</h3>
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
                  title="Foto profil"
                />
                <PhotoActionCard
                  canClear={Boolean(podiumPreviewUrl)}
                  canDownload={Boolean(podiumPreviewUrl)}
                  onClear={() => onPhotoClear("podium")}
                  onDownload={() => onDownloadPhoto("podium")}
                  onFileChange={(event) => onFileChange("podium", event)}
                  pending={Boolean(form.pendingPodiumFile)}
                  previewUrl={podiumPreviewUrl}
                  title="Foto podium"
                />
              </div>
            </section>

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
              Batal
            </button>
            <button className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")} disabled={saving} type="submit">
              <Check size={16} />
              {saving ? "Menyimpan..." : "Simpan anggota"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AccountManagementModal({
  adminCount,
  athlete,
  currentRole,
  error,
  onClose,
  onPasswordChange,
  onPasswordConfirmChange,
  onPasswordSubmit,
  onRoleChange,
  onUsernameChange,
  onUsernameSubmit,
  password,
  passwordConfirm,
  roleLoading,
  roleSaving,
  saving,
  showPassword,
  success,
  toggleShowPassword,
  username,
}: {
  adminCount: number;
  athlete: AthleteRecord;
  currentRole: AuthRole;
  error: string;
  onClose: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRoleChange: (role: AuthRole) => void;
  onUsernameChange: (value: string) => void;
  onUsernameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  passwordConfirm: string;
  roleLoading: boolean;
  roleSaving: boolean;
  saving: boolean;
  showPassword: boolean;
  success: string;
  toggleShowPassword: () => void;
  username: string;
}) {
  const dialogRef = useModalA11y<HTMLElement>(true, onClose);
  const passwordInputType = showPassword ? "text" : "password";
  const currentRoleLabel = ACCOUNT_ROLE_OPTIONS.find((option) => option.role === currentRole)?.label ?? "Anggota";

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-primary-charcoal/50 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label="Kelola akun"
        aria-modal="true"
        className="max-h-full w-full max-w-2xl overflow-hidden rounded-lg border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">Kelola akun</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">{athlete.name}</p>
          </div>
          <button
            aria-label="Tutup kelola akun"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[74vh] gap-5 overflow-y-auto p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-charcoal/70 dark:text-gray-300">
            <span className={cn("size-2 rounded-full", athlete.authUserId ? "bg-primary-green" : "bg-primary-charcoal/30")} />
            {accountStatusText(athlete)}
          </div>

          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}
          {success ? <div className="rounded-lg bg-primary-green/10 px-3 py-2 text-sm font-bold text-primary-green dark:bg-primary-green/15">{success}</div> : null}

          <form className="grid gap-3 border-b border-secondary-sand/60 pb-5 dark:border-zinc-800" onSubmit={onUsernameSubmit}>
            <div>
              <h3 className="font-poppins text-sm font-black text-primary-charcoal dark:text-gray-100">Username</h3>
              <p className="mt-1 text-sm font-medium text-primary-charcoal/60 dark:text-gray-400">Username digunakan untuk masuk ke akun anggota.</p>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-primary-charcoal/85 dark:text-gray-300">
              Username
              <input className={inputClassName()} disabled={!athlete.authUserId || saving} onChange={(event) => onUsernameChange(event.target.value)} value={username} />
            </label>
            <div className="flex justify-end">
              <button className={buttonClassName("bg-primary-brown px-4 text-white")} disabled={!athlete.authUserId || saving} type="submit">
                {saving ? "Menyimpan..." : "Simpan username"}
              </button>
            </div>
          </form>

          <form className="grid gap-3 border-b border-secondary-sand/60 pb-5 dark:border-zinc-800" onSubmit={onPasswordSubmit}>
            <div>
              <h3 className="font-poppins text-sm font-black text-primary-charcoal dark:text-gray-100">Password</h3>
              <p className="mt-1 text-sm font-medium text-primary-charcoal/60 dark:text-gray-400">Password saat ini tidak dapat dilihat oleh admin.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-primary-charcoal/85 dark:text-gray-300">
                Password baru
                <span className="relative">
                  <input
                    autoComplete="new-password"
                    className={inputClassName("pr-11")}
                    disabled={!athlete.authUserId || saving}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    type={passwordInputType}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Sembunyikan password baru" : "Tampilkan password baru"}
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-primary-charcoal/55 hover:bg-secondary-sand/30 dark:text-gray-400 dark:hover:bg-zinc-800"
                    onClick={toggleShowPassword}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-primary-charcoal/85 dark:text-gray-300">
                Konfirmasi password
                <input
                  autoComplete="new-password"
                  className={inputClassName()}
                  disabled={!athlete.authUserId || saving}
                  onChange={(event) => onPasswordConfirmChange(event.target.value)}
                  type={passwordInputType}
                  value={passwordConfirm}
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} disabled={!athlete.authUserId || saving} type="submit">
                <KeyRound size={16} />
                Atur ulang password
              </button>
            </div>
          </form>

          <section className="grid gap-2">
            <h3 className="font-poppins text-sm font-black text-primary-charcoal dark:text-gray-100">Peran</h3>
            <p className="text-sm font-medium leading-6 text-primary-charcoal/60 dark:text-gray-400">
              Peran akun menentukan akses ke area admin.
            </p>
            <div className="grid gap-3 rounded-lg border border-secondary-sand/70 bg-secondary-sand/12 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-primary-charcoal/60 dark:text-gray-400">Role saat ini</span>
                <span className="inline-flex items-center gap-2 font-black text-primary-charcoal dark:text-gray-100">
                  {roleLoading ? <Loader2 className="size-4 animate-spin text-primary-brown" /> : null}
                  {roleLoading ? "Memuat..." : currentRoleLabel}
                </span>
              </div>
              <div aria-label="Peran akun" className="grid gap-2 sm:grid-cols-2" role="group">
                {ACCOUNT_ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = currentRole === option.role;

                  return (
                    <button
                      aria-label={`Simpan peran akun sebagai ${option.label}`}
                      aria-pressed={selected}
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition",
                        selected
                          ? option.role === "admin"
                            ? "border-primary-brown bg-primary-brown text-white"
                            : "border-primary-green bg-primary-green text-white"
                          : "border-secondary-sand/70 bg-white text-primary-charcoal/78 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300 dark:hover:bg-zinc-800",
                      )}
                      disabled={!athlete.authUserId || roleLoading || roleSaving || selected}
                      key={option.role}
                      onClick={() => onRoleChange(option.role)}
                      type="button"
                    >
                      {roleSaving ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-semibold leading-5 text-primary-charcoal/55 dark:text-gray-500">
                {athlete.authUserId ? `${adminCount} admin aktif.` : "Akun anggota belum siap dipakai."}
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function PasswordResetConfirmationDialog({
  athlete,
  onCancel,
  onConfirm,
  saving,
}: {
  athlete: AthleteRecord;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const dialogRef = useModalA11y<HTMLElement>(true, onCancel);

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-primary-charcoal/55 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label="Konfirmasi atur ulang password"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-secondary-sand bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-white">Atur ulang password?</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-primary-charcoal/70 dark:text-gray-300">
          Apakah Anda yakin ingin mengubah password akun ini?
        </p>
        <div className="mt-4 rounded-lg bg-secondary-sand/20 px-3 py-3 text-sm font-semibold text-primary-charcoal/80 dark:bg-zinc-900 dark:text-gray-300">
          <div>Anggota: {athlete.name}</div>
          <div>Username: {displayUsername(athlete)}</div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} disabled={saving} onClick={onCancel} type="button">
            Batal
          </button>
          <button className={buttonClassName("bg-primary-brown px-4 text-white")} disabled={saving} onClick={onConfirm} type="button">
            {saving ? "Menyimpan..." : "Ubah password"}
          </button>
        </div>
      </section>
    </div>
  );
}

function DeleteMemberDialog({
  athlete,
  deleting,
  onCancel,
  onConfirm,
}: {
  athlete: AthleteRecord;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalA11y<HTMLElement>(true, onCancel);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/55 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label="Hapus anggota"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-secondary-sand bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-white">Hapus anggota?</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-primary-charcoal/70 dark:text-gray-300">Anda akan menghapus:</p>
        <div className="mt-3 rounded-lg bg-secondary-sand/20 px-3 py-3 text-sm font-semibold text-primary-charcoal/85 dark:bg-zinc-900 dark:text-gray-300">
          <div>{athlete.name}</div>
          <div>{displayUsername(athlete)}</div>
        </div>
        <p className="mt-4 text-sm font-medium leading-6 text-primary-charcoal/70 dark:text-gray-300">
          Profil dan akses anggota ini akan dilepas dari komunitas.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} disabled={deleting} onClick={onCancel} type="button">
            Batal
          </button>
          <button className={buttonClassName("border border-red-200/80 bg-red-50/70 px-4 text-red-700 hover:bg-red-100/80 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200 dark:hover:bg-red-950/45")} disabled={deleting} onClick={onConfirm} type="button">
            {deleting ? "Menghapus..." : "Hapus anggota"}
          </button>
        </div>
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
  const xLimits = cropFrameOffsetLimits(session.dimensions.width, frame.width);
  const yLimits = cropFrameOffsetLimits(session.dimensions.height, frame.height);
  const baseFrame = centeredCropFrame(session.dimensions, preset.aspectRatio);
  const zoom = Math.max(
    ATHLETE_IMAGE_CROP_ZOOM_LIMITS.min,
    Math.min(ATHLETE_IMAGE_CROP_ZOOM_LIMITS.max, Number((baseFrame.width / frame.width).toFixed(2))),
  );
  const cropTitle = session.kind === "profile" ? "Foto profil" : "Foto podium";
  const previewStyle: CSSProperties = {
    aspectRatio: `${preset.outputWidth} / ${preset.outputHeight}`,
  };
  const previewImagePlacement = cropFrameImagePlacement(session.dimensions, frame, { width: 100, height: 100 });
  const previewImageStyle: CSSProperties = {
    height: `${previewImagePlacement.height}%`,
    left: `${previewImagePlacement.x}%`,
    top: `${previewImagePlacement.y}%`,
    width: `${previewImagePlacement.width}%`,
  };

  function updateFrame(patch: Partial<CropFrame>) {
    onFrameChange(clampZoomableCropFrame({ ...frame, ...patch }, session.dimensions));
  }

  function updateZoom(nextZoom: number) {
    onFrameChange(
      cropFrameForZoom({
        aspectRatio: preset.aspectRatio,
        currentFrame: frame,
        source: session.dimensions,
        zoom: nextZoom,
      }),
    );
  }

  const dialogRef = useModalA11y<HTMLElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-primary-charcoal/60 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label={`Potong ${cropTitle}`}
        aria-modal="true"
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-lg border border-secondary-sand/70 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-black text-primary-charcoal dark:text-white">Potong {cropTitle}</h2>
            <p className="mt-1 text-sm font-medium text-primary-charcoal/70 dark:text-gray-300">Atur posisi sebelum menyimpan.</p>
          </div>
          <button
            aria-label="Tutup potong foto"
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[78vh] gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="grid place-items-center rounded-lg border border-secondary-sand/70 bg-secondary-sand/25 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div
              className={cn(
                "relative w-full max-w-[360px] overflow-hidden border-2 border-white bg-primary-charcoal/12 shadow-[0_18px_44px_rgba(0,0,0,0.22)] dark:bg-white/8",
                preset.frameClassName,
              )}
              style={previewStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`Pratinjau ${cropTitle.toLowerCase()}`}
                className="absolute max-w-none select-none"
                draggable={false}
                src={session.dataUrl}
                style={previewImageStyle}
              />
            </div>
          </div>

          <div className="grid content-start gap-4">
            <label className="grid gap-2 text-sm font-black text-primary-charcoal/85 dark:text-gray-300">
              Perbesar
              <input max={ATHLETE_IMAGE_CROP_ZOOM_LIMITS.max} min={ATHLETE_IMAGE_CROP_ZOOM_LIMITS.min} onChange={(event) => updateZoom(Number(event.target.value))} step="0.01" type="range" value={zoom} />
            </label>
            <label className="grid gap-2 text-sm font-black text-primary-charcoal/85 dark:text-gray-300">
              Geser horizontal
              <input max={xLimits.max} min={xLimits.min} onChange={(event) => updateFrame({ x: Number(event.target.value) })} step="1" type="range" value={frame.x} />
            </label>
            <label className="grid gap-2 text-sm font-black text-primary-charcoal/85 dark:text-gray-300">
              Geser vertikal
              <input max={yLimits.max} min={yLimits.min} onChange={(event) => updateFrame({ y: Number(event.target.value) })} step="1" type="range" value={frame.y} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <button className={buttonClassName("border border-secondary-sand/70 bg-white px-4 text-primary-charcoal/85 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-300")} onClick={onClose} type="button">
            Batal
          </button>
          <button className={buttonClassName("bg-primary-brown px-4 text-white dark:bg-primary-brown dark:text-white")} disabled={processing} onClick={onApply} type="button">
            <Crop size={16} />
            {processing ? "Memproses..." : "Gunakan foto"}
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
  const [status, setStatus] = useState("Memuat anggota");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropProcessing, setCropProcessing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<AthleteImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<AthleteToast | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [openMenuAthleteId, setOpenMenuAthleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AthleteRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [accountAthleteId, setAccountAthleteId] = useState<string | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountRoles, setAccountRoles] = useState<AthleteRoleRecord[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordConfirmationOpen, setPasswordConfirmationOpen] = useState(false);

  const usernamePreview = useMemo(
    () => (form.id && form.username ? form.username : deriveUsernameFromAthleteName(form.name)),
    [form.id, form.name, form.username],
  );
  const selectedAthlete = useMemo(
    () => athletes.find((athlete) => athlete.id === selectedAthleteId) ?? null,
    [athletes, selectedAthleteId],
  );
  const accountAthlete = useMemo(
    () => athletes.find((athlete) => athlete.id === accountAthleteId) ?? null,
    [athletes, accountAthleteId],
  );
  const accountRole = useMemo(
    () => accountRoles.find((role) => role.id === accountAthleteId)?.role ?? "user",
    [accountRoles, accountAthleteId],
  );
  const memberCountLabel = loading && !athletes.length ? "Memuat anggota" : `${athletes.length} anggota`;

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshAthletes(search);
    }, 320);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    void validateAthleteStorage().catch(() => null);
  }, []);

  useEffect(() => {
    if (!accountAthleteId) {
      return;
    }

    void refreshAthleteRoles();
  }, [accountAthleteId]);

  async function refreshAthletes(query = search) {
    setLoading(true);
    try {
      const rows = await listAthletes(query);
      setAthletes(rows);
      setStatus(rows.length ? `${rows.length} anggota` : query.trim() ? "Tidak ada anggota yang cocok" : "Belum ada anggota");
    } catch {
      setStatus("Anggota gagal dimuat. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAthleteRoles(reportError = true) {
    setRoleLoading(true);
    try {
      const payload = await listAthleteRoles();
      setAccountRoles(payload.athletes);
      setAdminCount(payload.adminCount);
    } catch (error) {
      if (reportError) {
        setAccountError(friendlyError(error, "Peran akun belum bisa dimuat. Silakan coba lagi."));
      }
    } finally {
      setRoleLoading(false);
    }
  }

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
    setOpenMenuAthleteId(null);
  }

  function openAccountModal(athlete: AthleteRecord) {
    setAccountAthleteId(athlete.id);
    setAccountUsername(athlete.username ?? "");
    setAccountPassword("");
    setAccountPasswordConfirm("");
    setAccountError("");
    setAccountSuccess("");
    setShowPassword(false);
    setOpenMenuAthleteId(null);
  }

  function closeAccountModal() {
    setAccountAthleteId(null);
    setAccountUsername("");
    setAccountPassword("");
    setAccountPasswordConfirm("");
    setAccountError("");
    setAccountSuccess("");
    setPasswordConfirmationOpen(false);
    setRoleSaving(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      const message = "Nama anggota wajib diisi.";
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
        setStatus("Data anggota berhasil diperbarui.");
      } else {
        await createAthlete(payload);
        setStatus("Anggota berhasil ditambahkan.");
      }
      showToast("Data anggota berhasil disimpan.", "success");
      clearAthleteLookupCache();
      resetFormModal();
      await refreshAthletes(search);
    } catch (error) {
      const message = friendlyError(error, "Data anggota gagal disimpan. Silakan coba lagi.");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(athlete: AthleteRecord) {
    setDeleting(true);
    try {
      await deleteAthleteRecord(athlete.id);
      clearAthleteLookupCache();
      setStatus("Anggota berhasil dihapus.");
      showToast("Anggota berhasil dihapus.", "success");
      setDeleteTarget(null);
      if (selectedAthleteId === athlete.id) {
        setSelectedAthleteId(null);
      }
      await refreshAthletes(search);
    } catch {
      const message = "Anggota gagal dihapus. Silakan coba lagi.";
      setStatus(message);
      showToast(message, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadCurrentPhoto(kind: AthletePhotoKind) {
    const photoUrl = kind === "profile" ? form.profilePreviewUrl || form.profilePhotoUrl : form.podiumPreviewUrl || form.podiumPhotoUrl;
    const label = kind === "profile" ? "Foto profil" : "Foto podium";
    if (!form.id || !photoUrl) {
      setStatus(`${label} belum tersedia untuk ${form.name}.`);
      return;
    }

    try {
      setStatus(`Mengunduh ${label.toLowerCase()} untuk ${form.name}.`);
      await downloadAthletePhoto(form.id, kind);
      setStatus(`${label} berhasil diunduh.`);
    } catch {
      setStatus("Foto gagal diunduh. Silakan coba lagi.");
    }
  }

  async function handleDownloadSportPodiumPhoto(key: SportPodiumPhotoKey) {
    const photoUrl = form.sportPodiumPreviewUrls[key] || form.sportPodiumPhotoUrls[key] || form.podiumPreviewUrl || form.podiumPhotoUrl;
    if (!photoUrl) {
      setStatus(`${sportPhotoLabel(key)} belum tersedia untuk ${form.name}.`);
      return;
    }

    try {
      const filenamePrefix = normalizeAthleteName(form.name).replace(/\s+/g, "-") || "anggota";
      setStatus(`Mengunduh foto ${sportPhotoLabel(key).toLowerCase()} untuk ${form.name}.`);
      await downloadAthletePhotoUrl(photoUrl, `${filenamePrefix}-${key}.webp`);
      setStatus("Foto berhasil diunduh.");
    } catch {
      setStatus("Foto gagal diunduh. Silakan coba lagi.");
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
    } catch {
      setStatus("Foto belum bisa dibuka. Gunakan file gambar lain.");
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
    } catch {
      setStatus("Foto belum bisa dibuka. Gunakan file gambar lain.");
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
      setStatus("Foto siap disimpan.");
    } catch {
      setStatus("Foto gagal dipotong. Silakan coba lagi.");
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
      setImportError(rows.length ? "" : "Tidak ada nama anggota yang bisa diproses.");
    } catch {
      setImportRows([]);
      setImportError("File CSV belum bisa dibaca. Periksa format file lalu coba lagi.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleImportAthletes() {
    if (!importRows.length) {
      setImportError("Tidak ada nama anggota yang bisa diproses.");
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
      const issueCount = summary.skippedDuplicates + summary.failed;
      const message = issueCount
        ? `Import selesai dengan beberapa masalah. ${summary.created} anggota ditambahkan. ${issueCount} baris perlu diperiksa.`
        : `${summary.created} anggota berhasil diproses.`;
      setStatus(message);
      showToast(message, "success");
    } catch (error) {
      setImportError(friendlyError(error, "Import gagal. Periksa file lalu coba lagi."));
    } finally {
      setImporting(false);
    }
  }

  async function handleAccountUsernameSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountAthlete) {
      return;
    }
    if (!accountUsername.trim()) {
      setAccountError("Username tidak boleh kosong.");
      setAccountSuccess("");
      return;
    }

    setAccountSaving(true);
    setAccountError("");
    setAccountSuccess("");
    try {
      const updated = await updateAthleteAccount(accountAthlete.id, { username: accountUsername });
      setAthletes((current) => replaceAthleteRecord(current, updated));
      setAccountUsername(updated.username ?? "");
      setAccountSuccess("Username berhasil diperbarui.");
      setStatus("Username berhasil diperbarui.");
      showToast("Username berhasil diperbarui.", "success");
      clearAthleteLookupCache();
    } catch (error) {
      setAccountError(friendlyError(error, "Username gagal diperbarui. Silakan coba lagi."));
    } finally {
      setAccountSaving(false);
    }
  }

  function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountError("");
    setAccountSuccess("");

    if (!accountAthlete?.authUserId) {
      setAccountError("Akun anggota belum siap dipakai.");
      return;
    }
    if (accountPassword.length < PASSWORD_MIN_LENGTH) {
      setAccountError(`Password minimal ${PASSWORD_MIN_LENGTH} karakter.`);
      return;
    }
    if (accountPassword !== accountPasswordConfirm) {
      setAccountError("Konfirmasi password tidak sama.");
      return;
    }

    setPasswordConfirmationOpen(true);
  }

  async function handleConfirmPasswordReset() {
    if (!accountAthlete) {
      return;
    }

    setAccountSaving(true);
    setAccountError("");
    try {
      const updated = await resetAthletePassword(accountAthlete.id, { password: accountPassword });
      setAthletes((current) => replaceAthleteRecord(current, updated));
      setAccountPassword("");
      setAccountPasswordConfirm("");
      setPasswordConfirmationOpen(false);
      setAccountSuccess("Password berhasil diubah.");
      setStatus("Password berhasil diubah.");
      showToast("Password berhasil diubah.", "success");
    } catch (error) {
      setPasswordConfirmationOpen(false);
      setAccountError(friendlyError(error, "Password gagal diperbarui. Silakan coba lagi."));
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleAccountRoleChange(role: AuthRole) {
    if (!accountAthlete) {
      return;
    }
    if (!accountAthlete.authUserId) {
      setAccountError("Akun anggota belum siap dipakai.");
      setAccountSuccess("");
      return;
    }
    if (accountRole === role) {
      return;
    }

    const previousRole = accountRole;
    setRoleSaving(true);
    setAccountError("");
    setAccountSuccess("");
    try {
      const updated = await updateAthleteRole(accountAthlete.id, role);
      setAccountRoles((current) => replaceAthleteRoleRecord(current, updated));
      if (previousRole !== updated.role) {
        setAdminCount((current) => Math.max(0, current + (updated.role === "admin" ? 1 : -1)));
      }
      setAccountSuccess("Peran akun berhasil diperbarui.");
      setStatus("Peran akun berhasil diperbarui.");
      showToast("Peran akun berhasil diperbarui.", "success");
      void refreshAthleteRoles(false);
    } catch (error) {
      setAccountError(friendlyError(error, "Peran akun gagal diperbarui. Silakan coba lagi."));
    } finally {
      setRoleSaving(false);
    }
  }

  function openMemberDetail(athlete: AthleteRecord) {
    setSelectedAthleteId(athlete.id);
    setOpenMenuAthleteId(null);
  }

  function openPhotoManager(athlete: AthleteRecord) {
    openEditModal(athlete);
  }

  function openDeleteDialog(athlete: AthleteRecord) {
    setDeleteTarget(athlete);
    setOpenMenuAthleteId(null);
  }

  return (
    <main className={embedded ? "bg-transparent text-primary-charcoal dark:text-gray-100" : "min-h-screen bg-[#f3f4f1] px-5 py-6 text-primary-charcoal"}>
      {toast ? (
        <div
          aria-live="polite"
          className={cn(
            "fixed bottom-5 left-5 right-5 z-[130] rounded-lg border px-4 py-3 text-sm font-black shadow-[0_18px_44px_rgba(0,0,0,0.16)] sm:left-auto sm:max-w-md",
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
          usernamePreview={usernamePreview}
        />
      ) : null}

      {accountAthlete ? (
        <AccountManagementModal
          adminCount={adminCount}
          athlete={accountAthlete}
          currentRole={accountRole}
          error={accountError}
          onClose={closeAccountModal}
          onPasswordChange={setAccountPassword}
          onPasswordConfirmChange={setAccountPasswordConfirm}
          onPasswordSubmit={requestPasswordReset}
          onRoleChange={(role) => void handleAccountRoleChange(role)}
          onUsernameChange={setAccountUsername}
          onUsernameSubmit={(event) => void handleAccountUsernameSave(event)}
          password={accountPassword}
          passwordConfirm={accountPasswordConfirm}
          roleLoading={roleLoading}
          roleSaving={roleSaving}
          saving={accountSaving}
          showPassword={showPassword}
          success={accountSuccess}
          toggleShowPassword={() => setShowPassword((current) => !current)}
          username={accountUsername}
        />
      ) : null}

      {passwordConfirmationOpen && accountAthlete ? (
        <PasswordResetConfirmationDialog
          athlete={accountAthlete}
          onCancel={() => setPasswordConfirmationOpen(false)}
          onConfirm={() => void handleConfirmPasswordReset()}
          saving={accountSaving}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteMemberDialog
          athlete={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete(deleteTarget)}
        />
      ) : null}

      {selectedAthlete ? (
        <MemberDetailDrawer
          athlete={selectedAthlete}
          onClose={() => setSelectedAthleteId(null)}
          onEdit={() => openEditModal(selectedAthlete)}
          onManageAccount={() => openAccountModal(selectedAthlete)}
          onManagePhotos={() => openPhotoManager(selectedAthlete)}
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

      <section className={cn("grid w-full min-w-0 gap-5", embedded ? "" : "min-h-screen content-start")}>
        <div className="min-w-0 rounded-[1.35rem] border border-secondary-sand/60 bg-white p-5 shadow-[0_14px_34px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 border-b border-secondary-sand/60 pb-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!embedded ? (
                  <Link
                    aria-label="Kembali ke admin"
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-secondary-sand/70 text-primary-charcoal/70 transition hover:bg-secondary-sand/20"
                    href="/admin?tab=athletes"
                  >
                    <ArrowLeft size={17} />
                  </Link>
                ) : null}
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Direktori Komunitas</p>
                  <h2 className="mt-1 font-poppins text-2xl font-black tracking-normal text-primary-charcoal dark:text-gray-100">Anggota</h2>
                  <p className="mt-1 text-sm text-primary-charcoal/60 dark:text-gray-400">Kelola data anggota dan akses akun komunitas.</p>
                </div>
              </div>
              <div className="mt-3 text-sm font-black text-primary-charcoal/70 dark:text-gray-300" role="status">
                {memberCountLabel}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button aria-label="Tambah anggota" onClick={openCreateModal}>
                <Plus size={16} />
                Tambah anggota
              </Button>
              <Button onClick={() => setImportOpen(true)} variant="secondary">
                <FileUp size={16} />
                Import anggota
              </Button>
            </div>
          </div>

          <div className="grid gap-4 pt-5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-charcoal/40" />
              <Input
                aria-label="Cari nama atau username"
                className="pl-9 dark:bg-zinc-950"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau username"
                value={search}
              />
            </label>

            {status && !loading && athletes.length ? (
              <div className="sr-only" role="status">
                {status}
              </div>
            ) : null}

            <div className="divide-y divide-secondary-sand/50 overflow-visible border-t border-secondary-sand/50 dark:divide-zinc-800 dark:border-zinc-800" data-testid="athlete-database-list">
              {athletes.map((athlete) => (
                <div
                  className="relative flex min-h-[72px] items-center gap-3 px-2 py-4 transition hover:bg-secondary-sand/16 dark:hover:bg-zinc-800/60 sm:px-3"
                  data-testid="member-list-row"
                  key={athlete.id}
                >
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openMemberDetail(athlete)} type="button">
                    <ProfilePreview athlete={athlete} />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-black text-primary-charcoal dark:text-white">{athlete.name}</span>
                      <span className="mt-1 block truncate text-sm font-semibold text-primary-charcoal/50 dark:text-gray-500">{displayUsername(athlete)}</span>
                    </span>
                  </button>

                  {athlete.authUserId ? (
                    <span className="hidden shrink-0 items-center gap-2 text-xs font-bold text-primary-charcoal/55 dark:text-gray-400 sm:inline-flex">
                      <span className="size-2 rounded-full bg-primary-green" />
                      Aktif
                    </span>
                  ) : null}

                  <button
                    aria-expanded={openMenuAthleteId === athlete.id}
                    aria-label={`Menu ${athlete.name}`}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-transparent text-primary-charcoal/65 transition hover:border-secondary-sand/70 hover:bg-white dark:text-gray-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    onClick={() => setOpenMenuAthleteId((current) => (current === athlete.id ? null : athlete.id))}
                    type="button"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {openMenuAthleteId === athlete.id ? (
                    <div className="absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-lg border border-secondary-sand/70 bg-white py-1 shadow-[0_18px_44px_rgba(31,31,31,0.14)] dark:border-zinc-800 dark:bg-zinc-900">
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-primary-charcoal/80 hover:bg-secondary-sand/20 dark:text-gray-200 dark:hover:bg-zinc-900" onClick={() => openMemberDetail(athlete)} type="button">
                        <UserRound size={15} />
                        Lihat profil
                      </button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-primary-charcoal/80 hover:bg-secondary-sand/20 dark:text-gray-200 dark:hover:bg-zinc-900" onClick={() => openEditModal(athlete)} type="button">
                        <Edit3 size={15} />
                        Edit anggota
                      </button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-primary-charcoal/80 hover:bg-secondary-sand/20 dark:text-gray-200 dark:hover:bg-zinc-900" onClick={() => openAccountModal(athlete)} type="button">
                        <KeyRound size={15} />
                        Kelola akun
                      </button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-primary-charcoal/80 hover:bg-secondary-sand/20 dark:text-gray-200 dark:hover:bg-zinc-900" onClick={() => openPhotoManager(athlete)} type="button">
                        <Camera size={15} />
                        Kelola foto
                      </button>
                      <div className="my-1 border-t border-secondary-sand/70 dark:border-zinc-800" />
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-red-600/85 hover:bg-secondary-sand/20 hover:text-red-700 dark:text-red-300/85 dark:hover:bg-zinc-900" onClick={() => openDeleteDialog(athlete)} type="button">
                        <Trash2 size={15} />
                        Hapus anggota
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}

              {!athletes.length ? (
                <div className="grid min-h-56 place-items-center px-4 py-12 text-center">
                  {loading ? (
                    <div className="grid justify-items-center gap-3 text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">
                      <Loader2 className="size-5 animate-spin text-primary-brown" />
                      Memuat anggota
                    </div>
                  ) : search.trim() ? (
                    <div>
                      <h3 className="font-poppins text-lg font-black text-primary-charcoal dark:text-white">Tidak ada anggota yang cocok</h3>
                      <p className="mt-2 text-sm font-medium text-primary-charcoal/55 dark:text-gray-400">Coba gunakan nama atau username lain.</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-poppins text-lg font-black text-primary-charcoal dark:text-white">Belum ada anggota</h3>
                      <p className="mt-2 text-sm font-medium text-primary-charcoal/55 dark:text-gray-400">Tambahkan anggota pertama untuk mulai mengelola komunitas.</p>
                      <Button className="mt-5" onClick={openCreateModal}>
                        <Plus size={16} />
                        Tambah anggota
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
