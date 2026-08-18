"use client";

/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, Check, ImagePlus, Loader2, Pencil, Plus, Save, Star, Trash2, X } from "lucide-react";
import type { AthleteRecord } from "@/lib/athletes/types";
import { listAthletes } from "@/lib/athletes/api";
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
  uploadActivityImage,
  type ActivityListItem,
} from "@/lib/activities/api";
import { ACTIVITY_TYPES, SCHEDULE_MODES, SPORT_TYPES } from "@/lib/activities/schema";
import { activityRegistrationState } from "@/lib/activities/registration";
import type { ActivityScheduleMode, ActivityVisibility } from "@/lib/activities/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface ActivityFormState {
  id?: string;
  name: string;
  activityType: string;
  sportType: string;
  description: string;
  location: string;
  startsAt: string;
  scheduleMode: ActivityScheduleMode;
  scheduleLabel: string;
  recurrenceInterval: number;
  recurrenceWeekday: number;
  recurrenceMonthWeek: number;
  recurrenceTime: string;
  documentationUrl: string;
  logoHasWhiteOutline: boolean;
  logoUrl: string;
  registrationClosed: boolean;
  registrationEnabled: boolean;
  visibility: ActivityVisibility;
  images: Array<{ imageUrl: string; altText?: string; isCover: boolean; sortOrder: number }>;
  imageUrl: string;
  participantAthleteIds: string[];
}

const EMPTY_FORM: ActivityFormState = {
  activityType: "Workout",
  description: "",
  documentationUrl: "",
  imageUrl: "",
  images: [],
  location: "",
  logoHasWhiteOutline: false,
  logoUrl: "",
  name: "",
  participantAthleteIds: [],
  registrationClosed: false,
  registrationEnabled: false,
  recurrenceInterval: 1,
  recurrenceMonthWeek: 1,
  recurrenceTime: "06:00",
  recurrenceWeekday: 0,
  scheduleLabel: "",
  scheduleMode: "single",
  sportType: "Run",
  startsAt: "",
  visibility: "internal",
};

const ACTIVITY_VISIBILITY_OPTIONS: Array<{ label: string; value: ActivityVisibility }> = [
  { label: "Internal - hanya user login / event eksternal", value: "internal" },
  { label: "Publik - tampil untuk guest / acara Altruist", value: "public" },
];

const WEEKDAY_OPTIONS = [
  { label: "Minggu", value: 0 },
  { label: "Senin", value: 1 },
  { label: "Selasa", value: 2 },
  { label: "Rabu", value: 3 },
  { label: "Kamis", value: 4 },
  { label: "Jumat", value: 5 },
  { label: "Sabtu", value: 6 },
];

const MONTH_WEEK_OPTIONS = [
  { label: "Minggu ke-1", value: 1 },
  { label: "Minggu ke-2", value: 2 },
  { label: "Minggu ke-3", value: 3 },
  { label: "Minggu ke-4", value: 4 },
];

const SCHEDULE_MODE_LABELS: Record<ActivityScheduleMode, string> = {
  coming_soon: "Coming Soon",
  flexible: "Fleksibel",
  monthly: "Bulanan",
  single: "Sekali",
  weekly: "Mingguan",
};

function toDatetimeLocal(value?: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function optionsWithCurrentValue(options: readonly string[], value: string): string[] {
  return value && !options.includes(value) ? [value, ...options] : [...options];
}

function normalizeImagesCover(images: ActivityFormState["images"]): ActivityFormState["images"] {
  const coverIndex = images.findIndex((image) => image.isCover);
  return images.map((image, index) => ({
    ...image,
    isCover: coverIndex >= 0 ? index === coverIndex : index === 0,
    sortOrder: index,
  }));
}

function formFromActivity(activity: ActivityListItem): ActivityFormState {
  return {
    activityType: activity.activityType || "Workout",
    description: activity.description,
    documentationUrl: activity.documentationUrl ?? "",
    id: activity.id,
    imageUrl: "",
    images: normalizeImagesCover(activity.images.map((image, index) => ({
      altText: image.altText,
      imageUrl: image.imageUrl,
      isCover: image.isCover || activity.coverImageUrl === image.imageUrl || (!activity.coverImageUrl && index === 0),
      sortOrder: image.sortOrder ?? index,
    }))),
    location: activity.location ?? "",
    logoHasWhiteOutline: activity.logoHasWhiteOutline ?? false,
    logoUrl: activity.logoUrl ?? "",
    name: activity.name,
    participantAthleteIds: activity.participants?.map((participant) => participant.athleteId) ?? [],
    registrationClosed: activity.registrationClosed ?? false,
    registrationEnabled: activity.registrationEnabled ?? false,
    recurrenceInterval: activity.recurrenceInterval ?? 1,
    recurrenceMonthWeek: activity.recurrenceMonthWeek ?? 1,
    recurrenceTime: activity.recurrenceTime ?? "06:00",
    recurrenceWeekday: activity.recurrenceWeekday ?? 0,
    scheduleLabel: activity.scheduleLabel ?? "",
    scheduleMode: activity.scheduleMode ?? "single",
    sportType: activity.sportType || "Run",
    startsAt: toDatetimeLocal(activity.startsAt),
    visibility: activity.visibility ?? "internal",
  };
}

export function ActivityAdminPanel() {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteRecord[]>([]);
  const [form, setForm] = useState<ActivityFormState>(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const selectedAthleteCount = useMemo(() => form.participantAthleteIds.length, [form.participantAthleteIds]);
  const activityTypeOptions = useMemo(() => optionsWithCurrentValue(ACTIVITY_TYPES, form.activityType), [form.activityType]);
  const sportTypeOptions = useMemo(() => optionsWithCurrentValue(SPORT_TYPES, form.sportType), [form.sportType]);
  const registrationStatus = useMemo(() => activityRegistrationState({
    registrationClosed: form.registrationClosed,
    registrationEnabled: form.registrationEnabled,
    startsAt: datetimeLocalToIso(form.startsAt),
    visibility: form.visibility,
  }), [form.registrationClosed, form.registrationEnabled, form.startsAt, form.visibility]);

  const clearError = useCallback(() => {
    setError(null);
    setAlertMessage(null);
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    setAlertMessage(message);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    clearError();
    try {
      const [activityPayload, athletePayload] = await Promise.all([listActivities(), listAthletes()]);
      setActivities(activityPayload.activities);
      setAthletes(athletePayload);
    } catch {
      showError("Kegiatan belum bisa dimuat. Coba segarkan halaman sebentar lagi.");
    } finally {
      setLoading(false);
    }
  }, [clearError, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      startsAt: toDatetimeLocal(new Date().toISOString()),
    });
    setModalOpen(true);
  }

  function openEdit(activity: ActivityListItem) {
    setForm(formFromActivity(activity));
    setModalOpen(true);
  }

  function toggleParticipant(athleteId: string) {
    setForm((current) => ({
      ...current,
      participantAthleteIds: current.participantAthleteIds.includes(athleteId)
        ? current.participantAthleteIds.filter((id) => id !== athleteId)
        : [...current.participantAthleteIds, athleteId],
    }));
  }

  function appendImageUrl() {
    const imageUrl = form.imageUrl.trim();
    if (!imageUrl) {
      return;
    }
    setForm((current) => ({
      ...current,
      imageUrl: "",
      images: normalizeImagesCover([...current.images, { imageUrl, isCover: false, sortOrder: current.images.length }]),
    }));
  }

  function removeImage(index: number) {
    setForm((current) => ({
      ...current,
      images: normalizeImagesCover(current.images.filter((_, imageIndex) => imageIndex !== index)),
    }));
  }

  function setCoverImage(index: number) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) => ({ ...image, isCover: imageIndex === index })),
    }));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setUploading(true);
    clearError();
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadActivityImage(file));
      }
      setForm((current) => ({
        ...current,
        images: [
          ...current.images,
          ...urls.map((imageUrl, index) => ({
            imageUrl,
            isCover: false,
            sortOrder: current.images.length + index,
          })),
        ],
      }));
      setForm((current) => ({ ...current, images: normalizeImagesCover(current.images) }));
    } catch {
      showError("Gambar belum berhasil diunggah. Coba lagi sebentar.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadLogoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    clearError();
    try {
      const logoUrl = await uploadActivityImage(file);
      setForm((current) => ({ ...current, logoUrl }));
    } catch {
      showError("Logo belum berhasil diunggah. Coba lagi sebentar.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    clearError();
    try {
      const payload = {
        activityType: form.activityType,
        description: form.description,
        documentationUrl: form.documentationUrl.trim() || null,
        images: normalizeImagesCover(form.images).map((image, index) => ({ ...image, sortOrder: index })),
        location: form.location,
        logoHasWhiteOutline: form.logoHasWhiteOutline,
        logoUrl: form.logoUrl.trim() || null,
        name: form.name,
        participantAthleteIds: form.participantAthleteIds,
        registrationClosed: form.registrationClosed,
        registrationEnabled: form.registrationEnabled,
        recurrenceInterval: form.scheduleMode === "weekly" || form.scheduleMode === "monthly" ? form.recurrenceInterval : null,
        recurrenceMonthWeek: form.scheduleMode === "monthly" ? form.recurrenceMonthWeek : null,
        recurrenceTime: form.scheduleMode === "weekly" || form.scheduleMode === "monthly" ? form.recurrenceTime : null,
        recurrenceWeekday: form.scheduleMode === "weekly" || form.scheduleMode === "monthly" ? form.recurrenceWeekday : null,
        scheduleLabel: form.scheduleLabel.trim() || null,
        scheduleMode: form.scheduleMode,
        sportType: form.sportType,
        startsAt: datetimeLocalToIso(form.startsAt) ?? null,
        visibility: form.visibility,
      };

      if (form.id) {
        await updateActivity(form.id, payload);
      } else {
        await createActivity(payload);
      }
      setModalOpen(false);
      await load();
    } catch {
      showError("Kegiatan belum berhasil disimpan. Coba lagi sebentar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeActivity(activity: ActivityListItem) {
    if (!window.confirm(`Hapus kegiatan "${activity.name}"?`)) {
      return;
    }

    setSaving(true);
    clearError();
    try {
      await deleteActivity(activity.id);
      setActivities((current) => current.filter((item) => item.id !== activity.id));
    } catch {
      showError("Kegiatan belum berhasil dihapus. Coba lagi sebentar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="min-w-0 rounded-[1.35rem] border border-secondary-sand/60 bg-white p-5 shadow-[0_14px_34px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-secondary-sand/60 pb-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Agenda Komunitas</p>
            <h2 className="mt-1 font-poppins text-2xl font-black tracking-normal text-primary-charcoal dark:text-gray-100">
              Kegiatan
            </h2>
            <p className="mt-1 text-sm text-primary-charcoal/60 dark:text-gray-400">
              Buat agenda, kelola galeri, dan tandai anggota yang ikut.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Kegiatan
          </Button>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid min-h-60 place-items-center">
            <Loader2 className="size-6 animate-spin text-primary-brown" />
          </div>
        ) : activities.length ? (
          <div className="divide-y divide-secondary-sand/50 dark:divide-zinc-800">
            {activities.map((activity) => (
              <article className="py-5 first:pt-5 last:pb-0" key={activity.id}>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary-brown/10 px-3 py-1 text-xs font-black text-primary-brown dark:bg-secondary-sand/10 dark:text-secondary-sand">
                        {activity.activityType}
                      </span>
                      <span className="rounded-full bg-primary-green/10 px-3 py-1 text-xs font-black text-primary-green">
                        {activity.sportType}
                      </span>
                      <span className="rounded-full bg-secondary-clay/10 px-3 py-1 text-xs font-black text-secondary-clay">
                        {activity.visibility === "public" ? "Publik" : "Internal"}
                      </span>
                      <span className={cn(
                        "rounded-full px-3 py-1 text-xs font-black",
                        activity.registrationOpen ? "bg-primary-green/10 text-primary-green" : "bg-primary-charcoal/10 text-primary-charcoal/60 dark:bg-gray-500/20 dark:text-gray-300",
                      )}>
                        {activity.registrationOpen ? "Daftar dibuka" : "Event Closed"}
                      </span>
                    </div>
                    <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">{activity.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">{activity.displaySchedule}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-primary-charcoal/65 dark:text-gray-400">{activity.description}</p>
                    <p className="mt-2 text-xs font-bold text-primary-charcoal/50 dark:text-gray-500">
                      {activity.images.length} gambar · {activity.participants?.length ?? 0} anggota ikut
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => openEdit(activity)} variant="secondary">
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button disabled={saving} onClick={() => removeActivity(activity)} variant="danger">
                      <Trash2 className="size-4" />
                      Hapus
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-5 py-12 text-center">
            <div>
              <CalendarPlus className="mx-auto mb-3 size-8 text-primary-brown" />
              <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Belum ada kegiatan.</h3>
            </div>
          </div>
        )}
      </section>

      <Modal className="max-h-[88vh] max-w-4xl overflow-y-auto" label={form.id ? "Edit kegiatan" : "Tambah kegiatan"} onClose={() => setModalOpen(false)} open={modalOpen}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">
              {form.id ? "Edit Kegiatan" : "Tambah Kegiatan"}
            </h2>
            <p className="mt-1 text-sm text-primary-charcoal/60 dark:text-gray-400">
              {selectedAthleteCount} anggota dipilih untuk ikut.
            </p>
          </div>
          <button className="grid size-9 place-items-center rounded-full hover:bg-secondary-sand/35 dark:hover:bg-zinc-800" onClick={() => setModalOpen(false)} type="button">
            <X className="size-5" />
          </button>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Nama kegiatan
              <Input onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Jenis kegiatan
              <select
                className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, activityType: event.target.value }))}
                value={form.activityType}
              >
                {activityTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Jenis olahraga
              <select
                className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, sportType: event.target.value }))}
                value={form.sportType}
              >
                {sportTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Visibilitas
              <select
                className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as ActivityVisibility }))}
                value={form.visibility}
              >
                {ACTIVITY_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Pengaturan waktu
              <select
                className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, scheduleMode: event.target.value as ActivityScheduleMode }))}
                value={form.scheduleMode}
              >
                {SCHEDULE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {SCHEDULE_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 rounded-xl border border-secondary-sand/70 p-4 dark:border-zinc-800 md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-primary-charcoal dark:text-gray-100">Pendaftaran public</p>
                  <p className="mt-1 text-xs font-semibold text-primary-charcoal/55 dark:text-gray-400">
                    Status saat ini: {registrationStatus.isOpen ? "Daftar dibuka" : "Event Closed"}
                  </p>
                </div>
                <span className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-xs font-black",
                  registrationStatus.isOpen ? "bg-primary-green/10 text-primary-green" : "bg-primary-charcoal/10 text-primary-charcoal/60 dark:bg-gray-500/20 dark:text-gray-300",
                )}>
                  {registrationStatus.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-secondary-sand/70 px-3 py-2 text-sm font-bold transition hover:bg-secondary-sand/20 dark:border-zinc-800 dark:hover:bg-zinc-800">
                  <input
                    checked={form.registrationEnabled}
                    className="size-4 accent-primary-green"
                    onChange={(event) => setForm((current) => ({ ...current, registrationEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                  Buka pendaftaran
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-secondary-sand/70 px-3 py-2 text-sm font-bold transition hover:bg-secondary-sand/20 dark:border-zinc-800 dark:hover:bg-zinc-800">
                  <input
                    checked={form.registrationClosed}
                    className="size-4 accent-primary-brown"
                    onChange={(event) => setForm((current) => ({ ...current, registrationClosed: event.target.checked }))}
                    type="checkbox"
                  />
                  Tutup manual
                </label>
              </div>
            </div>
            {form.scheduleMode === "single" ? (
              <label className="grid gap-2 text-sm font-bold">
                Tanggal dan waktu
                <Input onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required type="datetime-local" value={form.startsAt} />
              </label>
            ) : null}
            {form.scheduleMode === "weekly" || form.scheduleMode === "monthly" ? (
              <>
                <label className="grid gap-2 text-sm font-bold">
                  Interval
                  <select
                    className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                    onChange={(event) => setForm((current) => ({ ...current, recurrenceInterval: Number(event.target.value) }))}
                    value={form.recurrenceInterval}
                  >
                    {[1, 2, 3, 4].map((interval) => (
                      <option key={interval} value={interval}>
                        {form.scheduleMode === "weekly" ? `Setiap ${interval} minggu` : `Setiap ${interval} bulan`}
                      </option>
                    ))}
                  </select>
                </label>
                {form.scheduleMode === "monthly" ? (
                  <label className="grid gap-2 text-sm font-bold">
                    Minggu bulan
                    <select
                      className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                      onChange={(event) => setForm((current) => ({ ...current, recurrenceMonthWeek: Number(event.target.value) }))}
                      value={form.recurrenceMonthWeek}
                    >
                      {MONTH_WEEK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="grid gap-2 text-sm font-bold">
                  Hari
                  <select
                    className="h-11 rounded-xl border border-secondary-sand/70 bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                    onChange={(event) => setForm((current) => ({ ...current, recurrenceWeekday: Number(event.target.value) }))}
                    value={form.recurrenceWeekday}
                  >
                    {WEEKDAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Jam
                  <Input onChange={(event) => setForm((current) => ({ ...current, recurrenceTime: event.target.value }))} required type="time" value={form.recurrenceTime} />
                </label>
              </>
            ) : null}
            {form.scheduleMode === "flexible" || form.scheduleMode === "coming_soon" ? (
              <label className="grid gap-2 text-sm font-bold">
                Label jadwal
                <Input
                  onChange={(event) => setForm((current) => ({ ...current, scheduleLabel: event.target.value }))}
                  placeholder={form.scheduleMode === "coming_soon" ? "Coming Soon" : "Setiap minggu"}
                  required={form.scheduleMode === "flexible"}
                  value={form.scheduleLabel}
                />
              </label>
            ) : null}
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              Lokasi
              <Input onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required value={form.location} />
            </label>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              Link dokumentasi
              <Input onChange={(event) => setForm((current) => ({ ...current, documentationUrl: event.target.value }))} placeholder="https://..." type="url" value={form.documentationUrl} />
            </label>
            <div className="grid gap-3 md:col-span-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="grid flex-1 gap-2 text-sm font-bold">
                  Logo kegiatan
                  <Input onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="https://..." type="url" value={form.logoUrl} />
                </label>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-secondary-sand bg-white px-4 text-sm font-semibold transition hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100">
                  <input
                    checked={form.logoHasWhiteOutline}
                    className="size-4 accent-primary-green"
                    onChange={(event) => setForm((current) => ({ ...current, logoHasWhiteOutline: event.target.checked }))}
                    type="checkbox"
                  />
                  Outline putih
                </label>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-secondary-sand bg-white px-4 text-sm font-semibold transition hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100">
                  <ImagePlus className="size-4" />
                  {uploading ? "Mengunggah..." : "Unggah logo"}
                  <input accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => uploadLogoFile(event.target.files)} type="file" />
                </label>
              </div>
              {form.logoUrl ? (
                <div className="flex flex-col gap-3 rounded-xl border border-secondary-sand/70 bg-secondary-sand/10 p-4 dark:border-zinc-800 dark:bg-zinc-950/45 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-primary-brown dark:text-secondary-sand">Preview logo</p>
                    <img alt={`${form.name || "Kegiatan"} logo`} className={cn("max-h-20 max-w-full object-contain", form.logoHasWhiteOutline && "activity-logo-white-outline")} src={form.logoUrl} />
                  </div>
                  <Button onClick={() => setForm((current) => ({ ...current, logoUrl: "" }))} variant="secondary">
                    <Trash2 className="size-4" />
                    Hapus logo
                  </Button>
                </div>
              ) : null}
            </div>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              Deskripsi
              <textarea
                className="min-h-28 rounded-xl border border-secondary-sand/70 bg-white px-3 py-2.5 text-sm font-medium text-primary-charcoal outline-none transition placeholder:text-primary-charcoal/35 focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                required
                value={form.description}
              />
            </label>
          </div>

          <div className="grid gap-3 rounded-xl border border-secondary-sand/70 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="grid flex-1 gap-2 text-sm font-bold">
                Tambah gambar via URL
                <Input onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://..." type="url" value={form.imageUrl} />
              </label>
              <Button onClick={appendImageUrl} variant="secondary">
                <ImagePlus className="size-4" />
                Tambah URL
              </Button>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-secondary-sand bg-white px-4 text-sm font-semibold transition hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100">
                <ImagePlus className="size-4" />
                {uploading ? "Mengunggah..." : "Unggah"}
                <input accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} multiple onChange={(event) => uploadFiles(event.target.files)} type="file" />
              </label>
            </div>
            {form.images.length ? (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {form.images.map((image, index) => (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary-sand/25" key={`${image.imageUrl}-${index}`}>
                    <img alt={image.altText || form.name || "Gambar kegiatan"} className="h-full w-full object-cover" src={image.imageUrl} />
                    <button
                      className={cn(
                        "absolute left-2 top-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black shadow-sm transition",
                        image.isCover
                          ? "bg-primary-brown text-white"
                          : "bg-white/90 text-primary-charcoal hover:bg-secondary-sand dark:bg-zinc-950/90 dark:text-gray-100",
                      )}
                      onClick={() => setCoverImage(index)}
                      type="button"
                    >
                      {image.isCover ? <Check className="size-3.5" /> : <Star className="size-3.5" />}
                      {image.isCover ? "Sampul" : "Jadikan sampul"}
                    </button>
                    <button
                      className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-primary-charcoal/75 text-white"
                      onClick={() => removeImage(index)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-xl border border-secondary-sand/70 p-4 dark:border-zinc-800">
            <p className="text-sm font-black text-primary-charcoal dark:text-gray-100">Anggota yang ikut</p>
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {athletes.map((athlete) => (
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition",
                    form.participantAthleteIds.includes(athlete.id)
                      ? "border-primary-green bg-primary-green/10"
                      : "border-secondary-sand/70 hover:bg-secondary-sand/25 dark:border-zinc-800 dark:hover:bg-zinc-800",
                  )}
                  key={athlete.id}
                >
                  <input
                    checked={form.participantAthleteIds.includes(athlete.id)}
                    className="size-4 accent-primary-green"
                    onChange={() => toggleParticipant(athlete.id)}
                    type="checkbox"
                  />
                  <span className="truncate text-sm font-bold">{athlete.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="secondary">
              Batal
            </Button>
              <Button disabled={saving || uploading} type="submit">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan
              </Button>
            </div>
        </form>
      </Modal>

      {alertMessage ? (
        <Modal className="max-w-md" label="Peringatan kegiatan" onClose={() => setAlertMessage(null)} open={Boolean(alertMessage)}>
          <div className="grid gap-5" role="alert">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Gagal</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-300">{alertMessage}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setAlertMessage(null)} type="button">
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
