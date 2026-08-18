"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { listActivities, type ActivityListItem } from "@/lib/activities/api";
import { groupActivitiesByActivityType } from "@/lib/activities/activity-groups";
import { activityOccurrencesForMonth } from "@/lib/activities/schedule";
import { ActivityLogoTitle } from "@/components/activities/ActivityLogoTitle";
import { ActivityCover, sortedActivities } from "@/components/activities/ActivityPieces";
import { cn } from "@/lib/utils";

type ActivitiesPageMode = "events" | "calendar";

const WEEKDAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface CalendarDay {
  dateKey: string;
  day: number;
  inMonth: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthStartKey(value = new Date()): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-01`;
}

function parseMonthKey(value: string): { monthIndex: number; year: number } {
  const [year, month] = value.split("-").map(Number);
  return { monthIndex: Math.max(0, (month || 1) - 1), year: year || new Date().getFullYear() };
}

function shiftMonthKey(value: string, offset: number): string {
  const { monthIndex, year } = parseMonthKey(value);
  const next = new Date(year, monthIndex + offset, 1);
  return monthStartKey(next);
}

function monthLabel(value: string): string {
  const { monthIndex, year } = parseMonthKey(value);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthIndex, 1, 12)));
}

function dateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
}

function weekdayForDate(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day, 12)).getUTCDay();
}

function calendarDays(monthKey: string): CalendarDay[] {
  const { monthIndex, year } = parseMonthKey(monthKey);
  const currentMonthDays = daysInMonth(year, monthIndex);
  const firstWeekday = weekdayForDate(year, monthIndex, 1);
  const previousMonthDays = daysInMonth(year, monthIndex - 1);
  const days: CalendarDay[] = [];

  for (let index = firstWeekday - 1; index >= 0; index -= 1) {
    const day = previousMonthDays - index;
    const previous = new Date(year, monthIndex - 1, day);
    days.push({
      dateKey: dateKey(previous.getFullYear(), previous.getMonth(), day),
      day,
      inMonth: false,
    });
  }

  for (let day = 1; day <= currentMonthDays; day += 1) {
    days.push({ dateKey: dateKey(year, monthIndex, day), day, inMonth: true });
  }

  const nextDayCount = (7 - (days.length % 7)) % 7;
  for (let day = 1; day <= nextDayCount; day += 1) {
    const next = new Date(year, monthIndex + 1, day);
    days.push({
      dateKey: dateKey(next.getFullYear(), next.getMonth(), day),
      day,
      inMonth: false,
    });
  }

  return days;
}

function EventCard({
  activity,
  authenticated,
}: {
  activity: ActivityListItem;
  authenticated: boolean;
}) {
  return (
    <article
      className="overflow-hidden rounded-xl bg-white/90 shadow-sm ring-1 ring-secondary-sand/60 transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgb(31,31,31,0.12)] dark:bg-zinc-900/90 dark:ring-zinc-800"
      key={activity.id}
    >
      <Link
        aria-label={`Lihat detail ${activity.name}`}
        className="block text-left"
        href={`/kegiatan/${activity.id}`}
      >
        <ActivityCover activity={activity} />
        <div className="min-h-28 px-4 py-4">
          <ActivityLogoTitle
            activity={activity}
            as="h2"
            fallbackClassName="font-poppins text-lg font-black leading-snug text-primary-charcoal dark:text-gray-100"
            logoClassName="max-h-12"
          />
        </div>
      </Link>
      <div className="px-4 pb-4">
        {activity.registrationOpen ? (
          <Link
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary-brown px-4 text-sm font-black text-white transition hover:bg-primary-brown/90 dark:bg-secondary-sand dark:text-primary-charcoal dark:hover:bg-secondary-sand/90"
            href={`/kegiatan/${activity.id}/daftar`}
          >
            Daftar
          </Link>
        ) : authenticated ? (
          <p className="line-clamp-3 min-h-11 text-sm font-semibold leading-6 text-primary-charcoal/60 dark:text-gray-400">
            {activity.description}
          </p>
        ) : (
          <button
            className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg bg-primary-charcoal/35 px-4 text-sm font-black text-white/85 dark:bg-gray-500/70 dark:text-gray-100"
            disabled
            type="button"
          >
            Event Closed
          </button>
        )}
      </div>
    </article>
  );
}

export function ActivitiesPage({ mode = "events" }: { mode?: ActivitiesPageMode } = {}) {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(monthStartKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEventsMode = mode === "events";
  const isCalendarMode = mode === "calendar";
  const orderedActivities = useMemo(() => sortedActivities(activities), [activities]);
  const eventGroups = useMemo(() => groupActivitiesByActivityType(orderedActivities), [orderedActivities]);
  const visibleActivities = isEventsMode ? orderedActivities : activities;
  const calendarGrid = useMemo(() => calendarDays(calendarMonth), [calendarMonth]);
  const occurrences = useMemo(
    () => activities.flatMap((activity) => activityOccurrencesForMonth(activity, calendarMonth)),
    [activities, calendarMonth],
  );
  const occurrencesByDate = useMemo(() => {
    const byDate = new Map<string, typeof occurrences>();
    occurrences.forEach((occurrence) => {
      byDate.set(occurrence.dateKey, [...(byDate.get(occurrence.dateKey) ?? []), occurrence]);
    });
    return byDate;
  }, [occurrences]);
  const comingSoonActivities = useMemo(
    () => orderedActivities.filter((activity) => activity.scheduleMode === "coming_soon"),
    [orderedActivities],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await listActivities();
      setActivities(payload.activities);
      setAuthenticated(payload.authenticated);
    } catch {
      setError("Kegiatan belum bisa dimuat. Coba segarkan halaman sebentar lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="topbar-clearance w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-24">
      <div className="mb-6">
        <h1 className="font-poppins text-4xl font-black tracking-normal text-primary-charcoal dark:text-gray-100">
          {isCalendarMode ? "Kalender" : "Event"}
        </h1>
      </div>

      {error ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-secondary-sand/60 bg-white/75 dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 className="size-6 animate-spin text-primary-brown" />
        </div>
      ) : (
        <div className="grid gap-6">
          {visibleActivities.length ? (
            <>
              {isCalendarMode ? (
                <div className="grid gap-6">
                  <div className="rounded-xl border border-secondary-sand/70 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <button
                        aria-label="Bulan sebelumnya"
                        className="grid size-10 place-items-center rounded-lg border border-secondary-sand/70 transition hover:bg-secondary-sand/25 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        onClick={() => setCalendarMonth((current) => shiftMonthKey(current, -1))}
                        type="button"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <h2 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">{monthLabel(calendarMonth)}</h2>
                      <button
                        aria-label="Bulan berikutnya"
                        className="grid size-10 place-items-center rounded-lg border border-secondary-sand/70 transition hover:bg-secondary-sand/25 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        onClick={() => setCalendarMonth((current) => shiftMonthKey(current, 1))}
                        type="button"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-xl border border-secondary-sand/70 dark:border-zinc-800">
                        {WEEKDAY_SHORT.map((weekday) => (
                          <div className="border-b border-secondary-sand/70 bg-secondary-sand/20 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.08em] text-primary-charcoal/55 dark:border-zinc-800 dark:bg-zinc-950 dark:text-gray-400" key={weekday}>
                            {weekday}
                          </div>
                        ))}
                        {calendarGrid.map((day) => {
                          const dayOccurrences = occurrencesByDate.get(day.dateKey) ?? [];
                          return (
                            <div
                              className={cn(
                                "min-h-32 border-b border-r border-secondary-sand/60 p-2 last:border-r-0 dark:border-zinc-800",
                                day.inMonth ? "bg-white dark:bg-zinc-900" : "bg-secondary-sand/15 text-primary-charcoal/35 dark:bg-zinc-950/55 dark:text-gray-600",
                              )}
                              key={day.dateKey}
                            >
                              <p className="mb-2 text-xs font-black">{day.day}</p>
                              <div className="grid gap-1.5">
                                {dayOccurrences.map((occurrence) => {
                                  const activity = activities.find((item) => item.id === occurrence.activityId);
                                  if (!activity) {
                                    return null;
                                  }
                                  return (
                                    <Link
                                      className="rounded-lg bg-primary-green/10 px-2 py-1 text-left text-[11px] font-black leading-snug text-primary-green transition hover:bg-primary-green/20"
                                      href={`/kegiatan/${occurrence.activityId}`}
                                      key={`${occurrence.activityId}-${occurrence.dateKey}`}
                                    >
                                      <ActivityLogoTitle
                                        activity={activity}
                                        fallbackClassName="text-[11px] font-black leading-snug"
                                        logoClassName="max-h-5"
                                      />
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {comingSoonActivities.length ? (
                    <div className="rounded-xl border border-secondary-sand/70 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-primary-brown dark:text-secondary-sand">
                        <Clock className="size-4" />
                        Coming Soon
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {comingSoonActivities.map((activity) => (
                          <Link
                            className="rounded-lg border border-secondary-sand/60 px-3 py-2 text-left transition hover:border-primary-brown/40 dark:border-zinc-800"
                            href={`/kegiatan/${activity.id}`}
                            key={activity.id}
                          >
                            <ActivityLogoTitle
                              activity={activity}
                              className="text-sm font-black text-primary-charcoal dark:text-gray-100"
                              logoClassName="max-h-7"
                            />
                            <p className="text-xs font-bold text-primary-charcoal/55 dark:text-gray-400">{activity.displaySchedule}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isEventsMode ? (
                authenticated ? (
                  <div className="grid content-start gap-9">
                    {eventGroups.map((group) => (
                      <section className="grid gap-4" key={group.activityType}>
                        <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">
                          {group.activityType}
                        </h2>
                        <div className="grid content-start gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {group.activities.map((activity) => (
                            <EventCard activity={activity} authenticated={authenticated} key={activity.id} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="grid content-start gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {orderedActivities.map((activity) => (
                      <EventCard activity={activity} authenticated={authenticated} key={activity.id} />
                    ))}
                  </div>
                )
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-secondary-sand/70 bg-white/80 px-5 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">Belum ada kegiatan.</h2>
              <p className="mt-2 text-sm text-primary-charcoal/60 dark:text-gray-400">Agenda baru akan muncul di sini begitu siap dibagikan.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
