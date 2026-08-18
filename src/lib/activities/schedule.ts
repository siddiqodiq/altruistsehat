import type { ActivityDetails, ActivityImage, ActivityScheduleMode } from "./types";

const JAKARTA_OFFSET = "+07:00";
const TIME_ZONE = "Asia/Jakarta";

const WEEKDAY_LABELS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

export interface ActivityScheduleSource {
  id: string;
  name: string;
  scheduleMode: ActivityScheduleMode;
  scheduleLabel?: string;
  startsAt?: string;
  recurrenceInterval?: number;
  recurrenceWeekday?: number;
  recurrenceMonthWeek?: number;
  recurrenceTime?: string;
}

export interface ActivityCalendarOccurrence {
  activityId: string;
  activityName: string;
  dateKey: string;
  startsAt: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateKey(value: string): { day: number; monthIndex: number; year: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  return { day, monthIndex, year };
}

function dateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function weekdayForDate(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day, 12)).getUTCDay();
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
}

function isoForJakartaDateTime(localDateKey: string, time = "06:00"): string {
  return new Date(`${localDateKey}T${time}:00${JAKARTA_OFFSET}`).toISOString();
}

function jakartaDateKeyFromIso(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(value));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function formatActivityDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function activityHasDate(activity: Pick<ActivityScheduleSource, "startsAt">): boolean {
  if (!activity.startsAt) {
    return false;
  }

  return Number.isFinite(Date.parse(activity.startsAt));
}

function recurrenceTimeLabel(value?: string): string {
  return value ? `${value} WIB` : "06:00 WIB";
}

export function formatActivitySchedule(activity: ActivityScheduleSource): string {
  if (activity.scheduleLabel?.trim()) {
    return activity.scheduleLabel.trim();
  }

  if (activity.scheduleMode === "single" && activity.startsAt) {
    return formatActivityDateTime(activity.startsAt);
  }

  if (activity.scheduleMode === "weekly" && activity.recurrenceWeekday !== undefined) {
    const interval = Math.max(1, activity.recurrenceInterval ?? 1);
    const cadence = interval === 1 ? "Setiap minggu" : `Setiap ${interval} minggu`;
    return `${cadence}, ${WEEKDAY_LABELS[activity.recurrenceWeekday]}, ${recurrenceTimeLabel(activity.recurrenceTime)}`;
  }

  if (
    activity.scheduleMode === "monthly" &&
    activity.recurrenceWeekday !== undefined &&
    activity.recurrenceMonthWeek !== undefined
  ) {
    const interval = Math.max(1, activity.recurrenceInterval ?? 1);
    const cadence = interval === 1 ? "Setiap bulan" : `Setiap ${interval} bulan`;
    return `${cadence}, ${WEEKDAY_LABELS[activity.recurrenceWeekday]} minggu ke-${activity.recurrenceMonthWeek}, ${recurrenceTimeLabel(activity.recurrenceTime)}`;
  }

  if (activity.scheduleMode === "coming_soon") {
    return "Coming Soon";
  }

  return "Jadwal fleksibel";
}

export function coverImageForActivity(activity: Pick<ActivityDetails, "images">): ActivityImage | undefined {
  const images = [...activity.images].sort((left, right) => left.sortOrder - right.sortOrder);
  return images.find((image) => image.isCover) ?? images[0];
}

function singleOccurrenceForMonth(activity: ActivityScheduleSource, year: number, monthIndex: number): ActivityCalendarOccurrence[] {
  if (!activity.startsAt) {
    return [];
  }

  const activityDateKey = jakartaDateKeyFromIso(activity.startsAt);
  const parts = parseDateKey(activityDateKey);
  if (!parts || parts.year !== year || parts.monthIndex !== monthIndex) {
    return [];
  }

  return [{
    activityId: activity.id,
    activityName: activity.name,
    dateKey: activityDateKey,
    startsAt: activity.startsAt,
  }];
}

function weeklyOccurrencesForMonth(activity: ActivityScheduleSource, year: number, monthIndex: number): ActivityCalendarOccurrence[] {
  if (activity.recurrenceWeekday === undefined) {
    return [];
  }

  const interval = Math.max(1, activity.recurrenceInterval ?? 1);
  const time = activity.recurrenceTime ?? "06:00";
  const result: ActivityCalendarOccurrence[] = [];
  const maxDay = daysInMonth(year, monthIndex);
  let matchIndex = 0;

  for (let day = 1; day <= maxDay; day += 1) {
    if (weekdayForDate(year, monthIndex, day) !== activity.recurrenceWeekday) {
      continue;
    }
    if (matchIndex % interval === 0) {
      const key = dateKey(year, monthIndex, day);
      result.push({
        activityId: activity.id,
        activityName: activity.name,
        dateKey: key,
        startsAt: isoForJakartaDateTime(key, time),
      });
    }
    matchIndex += 1;
  }

  return result;
}

function monthlyOccurrencesForMonth(activity: ActivityScheduleSource, year: number, monthIndex: number): ActivityCalendarOccurrence[] {
  if (activity.recurrenceWeekday === undefined || activity.recurrenceMonthWeek === undefined) {
    return [];
  }

  const interval = Math.max(1, activity.recurrenceInterval ?? 1);
  const anchor = activity.startsAt ? parseDateKey(jakartaDateKeyFromIso(activity.startsAt)) : null;
  const currentMonthIndex = year * 12 + monthIndex;
  const anchorMonthIndex = anchor ? anchor.year * 12 + anchor.monthIndex : currentMonthIndex;
  const monthDistance = Math.abs(currentMonthIndex - anchorMonthIndex) % interval;
  if (monthDistance !== 0) {
    return [];
  }

  const time = activity.recurrenceTime ?? "06:00";
  const maxDay = daysInMonth(year, monthIndex);
  let matchIndex = 0;
  for (let day = 1; day <= maxDay; day += 1) {
    if (weekdayForDate(year, monthIndex, day) !== activity.recurrenceWeekday) {
      continue;
    }
    matchIndex += 1;
    if (matchIndex === activity.recurrenceMonthWeek) {
      const key = dateKey(year, monthIndex, day);
      return [{
        activityId: activity.id,
        activityName: activity.name,
        dateKey: key,
        startsAt: isoForJakartaDateTime(key, time),
      }];
    }
  }

  return [];
}

export function activityOccurrencesForMonth(activity: ActivityScheduleSource, monthStartIso: string): ActivityCalendarOccurrence[] {
  const month = parseDateKey(monthStartIso);
  if (!month) {
    return [];
  }

  if (activity.scheduleMode === "single") {
    return singleOccurrenceForMonth(activity, month.year, month.monthIndex);
  }
  if (activity.scheduleMode === "weekly") {
    return weeklyOccurrencesForMonth(activity, month.year, month.monthIndex);
  }
  if (activity.scheduleMode === "monthly") {
    return monthlyOccurrencesForMonth(activity, month.year, month.monthIndex);
  }

  return [];
}
