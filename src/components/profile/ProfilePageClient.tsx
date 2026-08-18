"use client";

/* eslint-disable @next/next/no-img-element */

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Check,
  Dumbbell,
  ImagePlus,
  KeyRound,
  Loader2,
  Medal,
  Pencil,
  Save,
  Shield,
  Trophy,
} from "lucide-react";
import {
  SPORT_PODIUM_PHOTO_OPTIONS,
  type SportPodiumPhotoKey,
  type SportPodiumPhotoUrls,
} from "@/lib/athletes/sport-podium-photos";
import type { AthleteRecord } from "@/lib/athletes/types";
import {
  ATHLETE_IMAGE_CROP_PRESETS,
  centeredCropFrame,
  cropImageFile,
  readImageFile,
  type AthleteImageKind,
} from "@/lib/athletes/image-crop";
import type { AuthRole } from "@/lib/auth/roles";
import { formatMetricValue } from "@/lib/leaderboard/metrics";
import type { ProfileMileageBySport } from "@/lib/profile/summary";
import { cn } from "@/lib/utils";

interface ProfilePayload {
  athlete: AthleteRecord | null;
  mileageBySport: ProfileMileageBySport[];
  role: AuthRole;
  sports: string[];
}

interface ProfileFormState {
  name: string;
  podiumPhotoUrl: string;
  profilePhotoUrl: string;
  sportPodiumPhotoUrls: SportPodiumPhotoUrls;
}

interface PasswordFormState {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
}

const emptyPasswordForm: PasswordFormState = {
  confirmPassword: "",
  currentPassword: "",
  newPassword: "",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AS";
}

function formFromAthlete(athlete: AthleteRecord): ProfileFormState {
  return {
    name: athlete.name,
    podiumPhotoUrl: athlete.podiumPhotoUrl ?? "",
    profilePhotoUrl: athlete.profilePhotoUrl ?? "",
    sportPodiumPhotoUrls: athlete.sportPodiumPhotoUrls ?? {},
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : response.statusText;
    throw new Error(message);
  }

  return payload as T;
}

async function uploadProfileImage(file: File, kind: string): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);

  const response = await fetch("/api/profile/upload", {
    body: formData,
    credentials: "same-origin",
    method: "POST",
  });
  const payload = await parseJsonResponse<{ url: string }>(response);
  return payload.url;
}

async function centeredCroppedFile(file: File, kind: AthleteImageKind): Promise<File> {
  const preset = ATHLETE_IMAGE_CROP_PRESETS[kind];
  const loaded = await readImageFile(file);
  const cropped = await cropImageFile(file, loaded.image, centeredCropFrame(loaded.dimensions, preset.aspectRatio), preset);
  return cropped.file;
}

function PhotoInput({
  label,
  onFile,
  pending,
  previewShape = "podium",
  previewUrl,
}: {
  label: string;
  onFile: (file: File) => void;
  pending?: boolean;
  previewShape?: "profile" | "podium";
  previewUrl?: string;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-secondary-sand/70 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-black text-primary-charcoal dark:text-gray-100">{label}</span>
        {pending ? <Loader2 className="size-4 animate-spin text-primary-brown" /> : null}
      </div>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden border border-secondary-sand/70 bg-secondary-sand/20 text-primary-charcoal/40 dark:border-zinc-700 dark:bg-zinc-900",
            previewShape === "profile" ? "size-20 rounded-full" : "h-28 w-[70px] rounded-xl",
          )}
        >
          {previewUrl ? (
            <img alt={`${label} preview`} className="h-full w-full object-cover object-center" src={previewUrl} />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </div>
        <label className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-secondary-sand bg-secondary-sand/15 px-3 text-sm font-black text-primary-charcoal/80 transition hover:border-primary-brown/35 hover:text-primary-brown dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300">
          <Camera className="size-4" />
          Choose & Crop
          <input
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onFile(file);
              }
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}

function EmptyLinkedState({ role }: { role: AuthRole }) {
  return (
    <section className="topbar-clearance mx-auto grid min-h-screen w-full max-w-3xl content-start px-4 pb-20">
      <div className="w-full rounded-xl border border-secondary-sand/70 bg-white p-6 text-center shadow-[0_18px_44px_rgb(90,46,23,0.10)] dark:border-zinc-800 dark:bg-zinc-950">
        <Shield className="mx-auto size-10 text-primary-brown dark:text-secondary-sand" />
        <h1 className="mt-4 font-poppins text-2xl font-black text-primary-charcoal dark:text-white">Profil belum terhubung</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-300">
          Akun {role} ini belum terhubung ke data atlet, jadi informasi mileage, olahraga, dan edit profil belum tersedia.
        </p>
      </div>
    </section>
  );
}

export function ProfilePageClient({ initialRole }: { initialRole: AuthRole }) {
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const athlete = payload?.athlete ?? null;
  const activeForm = form ?? (athlete ? formFromAthlete(athlete) : null);
  const mileageBySport = useMemo(() => payload?.mileageBySport ?? [], [payload?.mileageBySport]);

  const totalDistance = useMemo(
    () =>
      mileageBySport
        .filter((item) => item.metric === "distance_km" || item.metric === "cycling_distance_km")
        .reduce((sum, item) => sum + item.total, 0),
    [mileageBySport],
  );

  async function refreshProfile() {
    setLoading(true);
    try {
      const nextPayload = await parseJsonResponse<ProfilePayload>(
        await fetch("/api/profile", { credentials: "same-origin", headers: { Accept: "application/json" } }),
      );
      setPayload(nextPayload);
      if (nextPayload.athlete) {
        setForm(formFromAthlete(nextPayload.athlete));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProfile();
  }, []);

  async function handlePhoto(file: File, kind: AthleteImageKind, uploadKind: string, assign: (url: string) => void) {
    setUploadingKey(uploadKind);
    setMessage("");
    try {
      const cropped = await centeredCroppedFile(file, kind);
      const url = await uploadProfileImage(cropped, uploadKind);
      assign(url);
      setMessage("Foto siap disimpan.");
      setEditing(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Foto gagal diproses.");
    } finally {
      setUploadingKey(null);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeForm) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const nextPayload = await parseJsonResponse<ProfilePayload>(
        await fetch("/api/profile", {
          body: JSON.stringify(activeForm),
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }),
      );
      setPayload(nextPayload);
      if (nextPayload.athlete) {
        setForm(formFromAthlete(nextPayload.athlete));
      }
      setEditing(false);
      setMessage("Profil berhasil disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaving(true);
    setMessage("");
    try {
      await parseJsonResponse<{ success: true }>(
        await fetch("/api/profile/password", {
          body: JSON.stringify(passwordForm),
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }),
      );
      setPasswordForm(emptyPasswordForm);
      setMessage("Password berhasil diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password gagal diperbarui.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function updateSportPhoto(key: SportPodiumPhotoKey, url: string) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sportPodiumPhotoUrls: {
          ...current.sportPodiumPhotoUrls,
          [key]: url,
        },
      };
    });
  }

  if (loading) {
    return (
      <section className="topbar-clearance grid min-h-screen content-start justify-items-center px-4 pb-20">
        <Loader2 className="size-8 animate-spin text-primary-brown" />
      </section>
    );
  }

  if (!athlete || !activeForm) {
    return <EmptyLinkedState role={payload?.role ?? initialRole} />;
  }

  return (
    <section className="topbar-clearance min-h-screen bg-primary-beige px-4 pb-20 text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <div className="flex flex-col gap-5 rounded-xl border border-secondary-sand/70 bg-white p-5 shadow-[0_18px_44px_rgb(90,46,23,0.10)] dark:border-zinc-800 dark:bg-zinc-950 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-green/15 text-xl font-black text-primary-green">
              {activeForm.profilePhotoUrl ? (
                <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={activeForm.profilePhotoUrl} />
              ) : (
                initials(activeForm.name)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-brown dark:text-secondary-sand">Profil Atlet</p>
              <h1 className="mt-1 truncate font-poppins text-3xl font-black tracking-normal text-primary-charcoal dark:text-white">
                {activeForm.name}
              </h1>
              <p className="mt-1 text-sm font-semibold text-primary-charcoal/60 dark:text-gray-400">
                @{athlete.username ?? "username"} · {payload?.role ?? initialRole}
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-brown px-4 text-sm font-black text-white transition hover:bg-primary-brown/90"
            onClick={() => setEditing((current) => !current)}
            type="button"
          >
            <Pencil className="size-4" />
            Edit Profil
          </button>
        </div>

        {message ? (
          <div className="rounded-xl border border-secondary-sand/70 bg-white px-4 py-3 text-sm font-black text-primary-charcoal/75 dark:border-zinc-800 dark:bg-zinc-950 dark:text-gray-200" role="status">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-6">
            <div className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-primary-brown dark:text-secondary-sand" />
                <h2 className="font-poppins text-xl font-black">Data Mileage Semua Olahraga</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl bg-secondary-sand/20 p-4 dark:bg-zinc-900">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-primary-charcoal/50 dark:text-gray-400">Total Distance</p>
                  <p className="mt-2 text-2xl font-black text-primary-charcoal dark:text-white">
                    {formatMetricValue(totalDistance, "distance_km")}
                  </p>
                </div>
                {mileageBySport.map((item) => (
                  <div className="rounded-xl border border-secondary-sand/70 p-4 dark:border-zinc-800" key={`${item.templateId}-${item.metric}`}>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-primary-brown dark:text-secondary-sand">{item.sport}</p>
                    <p className="mt-2 text-xl font-black text-primary-charcoal dark:text-white">
                      {formatMetricValue(item.total, item.metric)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-primary-charcoal/55 dark:text-gray-400">{item.snapshotCount} minggu tersimpan</p>
                  </div>
                ))}
                {!mileageBySport.length ? (
                  <div className="rounded-xl border border-dashed border-secondary-sand p-4 text-sm font-semibold text-primary-charcoal/55 dark:border-zinc-700 dark:text-gray-400">
                    Belum ada data leaderboard untuk atlet ini.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Dumbbell className="size-5 text-primary-brown dark:text-secondary-sand" />
                <h2 className="font-poppins text-xl font-black">Olahraga yang Diikuti</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(payload?.sports ?? []).map((sport) => (
                  <span className="rounded-full bg-primary-green/12 px-3 py-1.5 text-sm font-black text-primary-green" key={sport}>
                    {sport}
                  </span>
                ))}
                {payload?.sports.length ? null : (
                  <span className="text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">Belum ada olahraga yang tercatat.</span>
                )}
              </div>
            </div>

            {editing ? (
              <form className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950" onSubmit={saveProfile}>
                <h2 className="font-poppins text-xl font-black">Edit Profil</h2>
                <label className="grid gap-2 text-sm font-black">
                  Nama Atlit
                  <input
                    className="h-11 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-brown focus:ring-2 focus:ring-primary-brown/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))}
                    value={activeForm.name}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <PhotoInput
                    label="Foto Avatar"
                    onFile={(file) =>
                      void handlePhoto(file, "profile", "profile", (url) =>
                        setForm((current) => (current ? { ...current, profilePhotoUrl: url } : current)),
                      )
                    }
                    pending={uploadingKey === "profile"}
                    previewShape="profile"
                    previewUrl={activeForm.profilePhotoUrl}
                  />
                  <PhotoInput
                    label="Foto Podium Utama"
                    onFile={(file) =>
                      void handlePhoto(file, "podium", "podium", (url) =>
                        setForm((current) => (current ? { ...current, podiumPhotoUrl: url } : current)),
                      )
                    }
                    pending={uploadingKey === "podium"}
                    previewUrl={activeForm.podiumPhotoUrl}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {SPORT_PODIUM_PHOTO_OPTIONS.map((option) => (
                    <PhotoInput
                      key={option.key}
                      label={`Podium ${option.label}`}
                      onFile={(file) => void handlePhoto(file, "podium", `sport:${option.key}`, (url) => updateSportPhoto(option.key, url))}
                      pending={uploadingKey === `sport:${option.key}`}
                      previewUrl={activeForm.sportPodiumPhotoUrls[option.key] || activeForm.podiumPhotoUrl}
                    />
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-green px-4 text-sm font-black text-white transition hover:bg-primary-green/90 disabled:cursor-wait disabled:opacity-70"
                    disabled={saving || Boolean(uploadingKey)}
                    type="submit"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Simpan Profil
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="grid content-start gap-6">
            <div className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Medal className="size-5 text-primary-brown dark:text-secondary-sand" />
                <h2 className="font-poppins text-xl font-black">Foto Podium</h2>
              </div>
              <div className="grid h-[360px] place-items-center overflow-hidden rounded-xl border border-secondary-sand/70 bg-secondary-sand/20 dark:border-zinc-800 dark:bg-zinc-900">
                {activeForm.podiumPhotoUrl ? (
                  <img alt={`${activeForm.name} podium`} className="h-full w-full object-cover object-center" src={activeForm.podiumPhotoUrl} />
                ) : (
                  <ImagePlus className="size-8 text-primary-charcoal/35 dark:text-gray-500" />
                )}
              </div>
            </div>

            <form className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950" onSubmit={changePassword}>
              <div className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary-brown dark:text-secondary-sand" />
                <h2 className="font-poppins text-xl font-black">Ganti Password</h2>
              </div>
              <label className="grid gap-2 text-sm font-black">
                Password Lama
                <input
                  autoComplete="current-password"
                  className="h-11 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-brown focus:ring-2 focus:ring-primary-brown/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  type="password"
                  value={passwordForm.currentPassword}
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Password Baru
                <input
                  autoComplete="new-password"
                  className="h-11 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-brown focus:ring-2 focus:ring-primary-brown/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  type="password"
                  value={passwordForm.newPassword}
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Konfirmasi Password Baru
                <input
                  autoComplete="new-password"
                  className="h-11 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-brown focus:ring-2 focus:ring-primary-brown/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  type="password"
                  value={passwordForm.confirmPassword}
                />
              </label>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary-brown/20 bg-secondary-sand/25 px-4 text-sm font-black text-primary-charcoal transition hover:border-primary-brown/35 hover:text-primary-brown disabled:cursor-wait disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
                disabled={passwordSaving}
                type="submit"
              >
                {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Simpan Password
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
