"use client";

/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, MapPin, X } from "lucide-react";
import { getActivity, registerActivity, type ActivityListItem } from "@/lib/activities/api";
import { ActivityLogoTitle } from "@/components/activities/ActivityLogoTitle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface GuestRegistrationForm {
  community: string;
  name: string;
  phone: string;
}

const emptyGuestForm: GuestRegistrationForm = {
  community: "",
  name: "",
  phone: "",
};

function RegistrationSummary({ activity }: { activity: ActivityListItem }) {
  const imageUrl = activity.coverImageUrl ?? activity.images[0]?.imageUrl;

  return (
    <section className="overflow-hidden rounded-xl border border-secondary-sand/70 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {imageUrl ? (
        <img alt={`${activity.name} cover`} className="aspect-[16/9] w-full object-cover" src={imageUrl} />
      ) : null}
      <div className="grid gap-4 p-5">
        <ActivityLogoTitle
          activity={activity}
          as="h1"
          fallbackClassName="font-poppins text-2xl font-black leading-tight text-primary-charcoal dark:text-gray-100"
          logoClassName="max-h-16"
        />
        <p className="text-sm leading-6 text-primary-charcoal/70 dark:text-gray-300">{activity.description}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-primary-charcoal/65 dark:text-gray-300">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" />
            {activity.displaySchedule}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4" />
            {activity.location}
          </span>
        </div>
      </div>
    </section>
  );
}

export function ActivityRegistrationPage({ activityId }: { activityId: string }) {
  const [activity, setActivity] = useState<ActivityListItem | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [confirmDismissed, setConfirmDismissed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState<GuestRegistrationForm>(emptyGuestForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registrationClosed = useMemo(() => activity ? !activity.registrationOpen : false, [activity]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getActivity(activityId);
      setActivity(payload.activity);
      setAuthenticated(payload.authenticated);
    } catch {
      setError("Informasi kegiatan belum bisa dimuat. Coba segarkan halaman sebentar lagi.");
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (authenticated && activity?.registrationOpen && !confirmDismissed && !message) {
      setConfirmOpen(true);
    }
  }, [activity?.registrationOpen, authenticated, confirmDismissed, message]);

  async function submitGuestRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activity) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await registerActivity(activity.id, form);
      setForm(emptyGuestForm);
      setMessage("Pendaftaran berhasil. Sampai ketemu di kegiatan.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pendaftaran belum berhasil. Coba lagi sebentar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmAuthenticatedRegistration() {
    if (!activity) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await registerActivity(activity.id);
      setConfirmOpen(false);
      setConfirmDismissed(true);
      setMessage("Pendaftaran berhasil. Sampai ketemu di kegiatan.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pendaftaran belum berhasil. Coba lagi sebentar.");
    } finally {
      setSaving(false);
    }
  }

  function closeConfirmation() {
    setConfirmOpen(false);
    setConfirmDismissed(true);
  }

  return (
    <section className="topbar-clearance mx-auto grid w-full max-w-3xl gap-6 px-4 pb-24 sm:px-6 lg:px-8">
      <Link className="text-sm font-black text-primary-brown transition hover:text-primary-brown/75 dark:text-secondary-sand" href={`/kegiatan/${activityId}`}>
        Kembali ke detail
      </Link>

      {loading ? (
        <div className="grid min-h-[360px] place-items-center rounded-xl border border-secondary-sand/70 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 className="size-6 animate-spin text-primary-brown" />
        </div>
      ) : activity ? (
        <>
          <RegistrationSummary activity={activity} />

          {message ? (
            <div className="rounded-xl border border-primary-green/25 bg-primary-green/10 px-4 py-3 text-sm font-bold text-primary-green">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {registrationClosed ? (
            <div className="rounded-xl border border-secondary-sand/70 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">Event Closed</h2>
              <p className="mt-2 text-sm leading-6 text-primary-charcoal/60 dark:text-gray-400">Pendaftaran kegiatan ini sudah ditutup.</p>
            </div>
          ) : authenticated ? (
            <div className="rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Konfirmasi pendaftaran</h2>
                  <p className="mt-1 text-sm leading-6 text-primary-charcoal/60 dark:text-gray-400">Lanjutkan pendaftaran dengan akun yang sedang login.</p>
                </div>
                <Button onClick={() => setConfirmOpen(true)}>
                  <CheckCircle2 className="size-4" />
                  Konfirmasi daftar
                </Button>
              </div>
            </div>
          ) : (
            <form className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" onSubmit={submitGuestRegistration}>
              <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Daftar sebagai guest</h2>
              <label className="grid gap-2 text-sm font-bold">
                Nama
                <Input onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                No HP
                <Input inputMode="tel" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required value={form.phone} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Komunitas
                <Input onChange={(event) => setForm((current) => ({ ...current, community: event.target.value }))} placeholder="Umum" required value={form.community} />
              </label>
              <div className="flex justify-end">
                <Button disabled={saving} type="submit">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Daftar
                </Button>
              </div>
            </form>
          )}

          <Modal className="max-w-md" label="Konfirmasi pendaftaran" onClose={closeConfirmation} open={confirmOpen}>
            <div className="grid gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Konfirmasi pendaftaran</h2>
                  <p className="mt-2 text-sm leading-6 text-primary-charcoal/65 dark:text-gray-300">
                    Anda akan terdaftar untuk {activity.name}.
                  </p>
                </div>
                <button className="grid size-9 place-items-center rounded-full hover:bg-secondary-sand/35 dark:hover:bg-zinc-800" onClick={closeConfirmation} type="button">
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={closeConfirmation} variant="secondary">
                  Batal
                </Button>
                <Button disabled={saving} onClick={confirmAuthenticatedRegistration}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Konfirmasi daftar
                </Button>
              </div>
            </div>
          </Modal>
        </>
      ) : (
        <div className="rounded-xl border border-secondary-sand/70 bg-white/80 px-5 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="font-poppins text-3xl font-black text-primary-charcoal dark:text-gray-100">Kegiatan tidak ditemukan.</h1>
        </div>
      )}
    </section>
  );
}
