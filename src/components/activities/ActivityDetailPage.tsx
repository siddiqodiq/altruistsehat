"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { listActivities, type ActivityListItem } from "@/lib/activities/api";
import { ActivityLogoTitle } from "@/components/activities/ActivityLogoTitle";
import { ActivityCover, ActivityDetailContent, ActivityMeta, sortedActivities } from "@/components/activities/ActivityPieces";

const fallbackShellClassName = "topbar-clearance px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12";

export function ActivityDetailPage({ activityId }: { activityId: string }) {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderedActivities = useMemo(() => sortedActivities(activities), [activities]);
  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === activityId) ?? null,
    [activities, activityId],
  );
  const suggestedActivities = useMemo(
    () => orderedActivities.filter((activity) => activity.id !== activityId).slice(0, 3),
    [activityId, orderedActivities],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await listActivities();
      setActivities(payload.activities);
      setAuthenticated(payload.authenticated);
    } catch {
      setError("Detail kegiatan belum bisa dimuat. Coba segarkan halaman sebentar lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [activityId]);

  return (
    <section className="w-full bg-primary-beige pb-24 text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      {loading ? (
        <div className={fallbackShellClassName}>
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-secondary-sand/60 bg-white/75 dark:border-zinc-800 dark:bg-zinc-900">
            <Loader2 className="size-6 animate-spin text-primary-brown" />
          </div>
        </div>
      ) : error ? (
        <div className={fallbackShellClassName}>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        </div>
      ) : selectedActivity ? (
        <>
          <ActivityDetailContent
            activity={selectedActivity}
            authenticated={authenticated}
          />

          {suggestedActivities.length ? (
            <section className="mt-14 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">
                  Kegiatan lainnya
                </h2>
                <Link
                  className="text-sm font-black text-primary-brown transition hover:text-primary-brown/75 dark:text-secondary-sand"
                  href="/event"
                >
                  Lihat semua
                </Link>
              </div>
              <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {suggestedActivities.map((activity) => (
                  <Link
                    className="rounded-xl border border-secondary-sand/70 bg-white/90 p-3 text-left shadow-sm transition hover:border-primary-brown/45 dark:border-zinc-800 dark:bg-zinc-900/90"
                    href={`/kegiatan/${activity.id}`}
                    key={activity.id}
                  >
                    <ActivityCover activity={activity} />
                    <div className="mt-3">
                      <ActivityMeta activity={activity} />
                      <ActivityLogoTitle
                        activity={activity}
                        as="h3"
                        className="mt-3"
                        fallbackClassName="font-poppins text-lg font-black text-primary-charcoal dark:text-gray-100"
                        logoClassName="max-h-12"
                      />
                      <p className="mt-1 text-sm font-bold text-primary-charcoal/55 dark:text-gray-400">{activity.displaySchedule}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className={fallbackShellClassName}>
          <div className="rounded-xl border border-secondary-sand/70 bg-white/80 px-5 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="font-poppins text-3xl font-black text-primary-charcoal dark:text-gray-100">Kegiatan tidak ditemukan.</h1>
            <p className="mt-2 text-sm text-primary-charcoal/60 dark:text-gray-400">Agenda ini mungkin sudah tidak tersedia.</p>
          </div>
        </div>
      )}
    </section>
  );
}
