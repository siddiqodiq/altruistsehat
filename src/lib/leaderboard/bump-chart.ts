import { normalizeAthleteName } from "../athletes/normalize";
import { buildLeaderboardRows } from "./ranking";
import { compareSnapshotsByWeekAsc, weekIndexFromWeekNumber, type LeaderboardWeekSnapshot } from "./week-snapshots";
import type { AthleteEntry, MetricType } from "./types";

export interface BumpChartWeek {
  key: string;
  label: string;
  monthKey: string;
  monthLabel: string;
  periodEndLabel: string;
  periodLabel: string;
  periodStartLabel: string;
  snapshot: LeaderboardWeekSnapshot;
}

export interface BumpChartPoint {
  weekKey: string;
  rank: number | null;
  value: number | null;
}

export interface BumpChartSeries {
  key: string;
  name: string;
  metric: MetricType;
  latestRank: number;
  latestValue: number;
  previousRank?: number;
  rankDelta: number;
  points: BumpChartPoint[];
}

export interface BumpChartMover {
  key: string;
  name: string;
  delta: number;
  fromRank: number;
  toRank: number;
}

export interface BumpChartData {
  weeks: BumpChartWeek[];
  series: BumpChartSeries[];
  maxRank: number;
  metric: MetricType;
  topMovers: BumpChartMover[];
  biggestDrops: BumpChartMover[];
}

export function leaderboardAthleteKey(athlete: Pick<AthleteEntry, "athleteId" | "normalizedName" | "name">): string {
  return athlete.athleteId ?? athlete.normalizedName ?? normalizeAthleteName(athlete.name);
}

function weekLabel(snapshot: LeaderboardWeekSnapshot): string {
  const week = weekIndexFromWeekNumber(snapshot.weekNumber);
  return `W${week}`;
}

const monthAliases: Record<string, { index: number; label: string }> = {
  jan: { index: 0, label: "Jan" },
  january: { index: 0, label: "Jan" },
  januari: { index: 0, label: "Jan" },
  feb: { index: 1, label: "Feb" },
  february: { index: 1, label: "Feb" },
  februari: { index: 1, label: "Feb" },
  mar: { index: 2, label: "Mar" },
  march: { index: 2, label: "Mar" },
  maret: { index: 2, label: "Mar" },
  apr: { index: 3, label: "Apr" },
  april: { index: 3, label: "Apr" },
  may: { index: 4, label: "Mei" },
  mei: { index: 4, label: "Mei" },
  jun: { index: 5, label: "Jun" },
  june: { index: 5, label: "Jun" },
  juni: { index: 5, label: "Jun" },
  jul: { index: 6, label: "Jul" },
  july: { index: 6, label: "Jul" },
  juli: { index: 6, label: "Jul" },
  aug: { index: 7, label: "Agu" },
  august: { index: 7, label: "Agu" },
  agustus: { index: 7, label: "Agu" },
  sep: { index: 8, label: "Sep" },
  sept: { index: 8, label: "Sep" },
  september: { index: 8, label: "Sep" },
  oct: { index: 9, label: "Okt" },
  october: { index: 9, label: "Okt" },
  okt: { index: 9, label: "Okt" },
  oktober: { index: 9, label: "Okt" },
  nov: { index: 10, label: "Nov" },
  november: { index: 10, label: "Nov" },
  dec: { index: 11, label: "Des" },
  december: { index: 11, label: "Des" },
  des: { index: 11, label: "Des" },
  desember: { index: 11, label: "Des" },
};

function normalizeMonth(value: string) {
  return monthAliases[value.trim().toLowerCase()] ?? { index: 0, label: value.slice(0, 3) };
}

function parseSnapshotDateRange(snapshot: LeaderboardWeekSnapshot) {
  const range = snapshot.spec.dateRange?.trim();
  const fallback = weekLabel(snapshot);

  if (!range) {
    return {
      monthKey: `${snapshot.seasonYear}:${snapshot.weekNumber}`,
      monthLabel: fallback,
      periodEndLabel: fallback,
      periodLabel: fallback,
      periodStartLabel: fallback,
    };
  }

  const match = range.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);

  if (!match) {
    return {
      monthKey: range,
      monthLabel: range,
      periodEndLabel: range,
      periodLabel: range,
      periodStartLabel: range,
    };
  }

  const [, startDay, startMonthRaw, startYear, endDay, endMonthRaw, endYear] = match;
  const startMonth = normalizeMonth(startMonthRaw);
  const endMonth = normalizeMonth(endMonthRaw);
  const monthLabel = `${endMonth.label} ${endYear}`;
  const monthKey = `${endYear}-${String(endMonth.index + 1).padStart(2, "0")}`;
  const periodStartLabel = `${Number(startDay)} ${startMonth.label} ${startYear}`;
  const periodEndLabel = `${Number(endDay)} ${endMonth.label} ${endYear}`;
  const periodLabel = startMonth.index === endMonth.index && startYear === endYear
    ? `${Number(startDay)}–${Number(endDay)} ${endMonth.label} ${endYear}`
    : startYear === endYear
      ? `${Number(startDay)} ${startMonth.label} – ${Number(endDay)} ${endMonth.label} ${endYear}`
      : `${periodStartLabel} – ${periodEndLabel}`;

  return {
    monthKey,
    monthLabel,
    periodEndLabel,
    periodLabel,
    periodStartLabel,
  };
}

function rankedRowsForSnapshot(snapshot: LeaderboardWeekSnapshot, maxRank: number) {
  return buildLeaderboardRows(snapshot.spec.athletes, maxRank).map((athlete) => ({
    key: leaderboardAthleteKey(athlete),
    athlete,
  }));
}

export function calculateTopMovers(series: BumpChartSeries[], limit = 3) {
  const movers = series
    .filter((item) => item.previousRank !== undefined && item.rankDelta > 0)
    .sort((left, right) => right.rankDelta - left.rankDelta || left.latestRank - right.latestRank)
    .slice(0, limit)
    .map((item) => ({
      key: item.key,
      name: item.name,
      delta: item.rankDelta,
      fromRank: item.previousRank ?? item.latestRank,
      toRank: item.latestRank,
    }));
  const drops = series
    .filter((item) => item.previousRank !== undefined && item.rankDelta < 0)
    .sort((left, right) => left.rankDelta - right.rankDelta || right.latestRank - left.latestRank)
    .slice(0, limit)
    .map((item) => ({
      key: item.key,
      name: item.name,
      delta: item.rankDelta,
      fromRank: item.previousRank ?? item.latestRank,
      toRank: item.latestRank,
    }));

  return { movers, drops };
}

export function buildBumpChartData(
  snapshots: LeaderboardWeekSnapshot[],
  options: { maxWeeks?: number; maxRank?: number } = {},
): BumpChartData {
  const maxWeeks = options.maxWeeks ?? 8;
  const maxRank = options.maxRank ?? 10;
  const weeks = snapshots
    .filter((snapshot) => snapshot.spec.athletes.length)
    .slice()
    .sort(compareSnapshotsByWeekAsc)
    .slice(-maxWeeks)
    .map((snapshot) => ({
      key: `${snapshot.seasonYear}:${snapshot.weekNumber}:${snapshot.templateId}`,
      label: weekLabel(snapshot),
      ...parseSnapshotDateRange(snapshot),
      snapshot,
    }));

  const latest = weeks[weeks.length - 1]?.snapshot;
  if (!latest) {
    return { weeks, series: [], maxRank, metric: "distance_km", topMovers: [], biggestDrops: [] };
  }

  const rankedWeeks = weeks.map((week) => {
    const rows = rankedRowsForSnapshot(week.snapshot, maxRank);
    const rankByKey = new Map<string, { rank: number; value: number; name: string }>();

    rows.forEach(({ key, athlete }) => {
      rankByKey.set(key, {
        rank: athlete.rank,
        value: athlete.value,
        name: athlete.name,
      });
    });

    return { week, rows, rankByKey };
  });

  const athleteOrder = new Map<string, number>();
  const athleteNames = new Map<string, string>();
  const firstSeenRank = new Map<string, number>();

  rankedWeeks.forEach(({ rows }, weekIndex) => {
    rows.forEach(({ key, athlete }) => {
      if (!athleteOrder.has(key)) {
        athleteOrder.set(key, weekIndex * maxRank + athlete.rank);
        firstSeenRank.set(key, athlete.rank);
      }

      athleteNames.set(key, athlete.name);
    });
  });

  const latestWeekRanks = rankedWeeks[rankedWeeks.length - 1]?.rankByKey ?? new Map<string, { rank: number; value: number; name: string }>();
  const previousWeekRanks = rankedWeeks[rankedWeeks.length - 2]?.rankByKey ?? new Map<string, { rank: number; value: number; name: string }>();

  const series = Array.from(athleteOrder.keys()).map((key) => {
    const points = rankedWeeks.map(({ week, rankByKey }) => {
      const ranked = rankByKey.get(key);

      return {
        weekKey: week.key,
        rank: ranked?.rank ?? null,
        value: ranked?.value ?? null,
      } satisfies BumpChartPoint;
    });
    const latestPoint = latestWeekRanks.get(key);
    const previousPoint = previousWeekRanks.get(key);
    const lastVisiblePoint = [...points].reverse().find((point) => point.rank !== null);

    return {
      key,
      name: latestPoint?.name ?? athleteNames.get(key) ?? key,
      metric: latest.spec.metric,
      latestRank: latestPoint?.rank ?? maxRank + 1,
      latestValue: latestPoint?.value ?? lastVisiblePoint?.value ?? 0,
      previousRank: latestPoint && previousPoint ? previousPoint.rank : undefined,
      rankDelta: latestPoint && previousPoint ? previousPoint.rank - latestPoint.rank : 0,
      points,
    } satisfies BumpChartSeries;
  });

  const orderedSeries = series.sort((left, right) => {
    const latestRankDifference = left.latestRank - right.latestRank;
    if (latestRankDifference !== 0) {
      return latestRankDifference;
    }

    return (athleteOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (athleteOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER)
      || (firstSeenRank.get(left.key) ?? maxRank) - (firstSeenRank.get(right.key) ?? maxRank);
  });
  const movers = calculateTopMovers(orderedSeries.filter((item) => item.latestRank <= maxRank));

  return {
    weeks,
    series: orderedSeries,
    maxRank,
    metric: latest.spec.metric,
    topMovers: movers.movers,
    biggestDrops: movers.drops,
  };
}
