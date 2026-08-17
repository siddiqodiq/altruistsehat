"use client";

import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpRight,
  Bike,
  CalendarDays,
  Download,
  Dumbbell,
  Footprints,
  Minus,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { LeaderboardCanvas } from "./LeaderboardCanvas";
import { resolveUsableAthletePhotoUrl } from "@/lib/athletes/photo-url";
import { initialsForName } from "@/lib/leaderboard/images";
import { buildBumpChartData, leaderboardAthleteKey, type BumpChartData } from "@/lib/leaderboard/bump-chart";
import {
  categoryConfigForId,
  type LeaderboardCategoryId,
  type LeaderboardMetricOption,
  type LeaderboardSportOption,
} from "@/lib/leaderboard/categories";
import { calculateWeeklyComparison, formatMetricValue } from "@/lib/leaderboard/metrics";
import {
  clampExportPhotoAdjustment,
  EXPORT_PHOTO_ADJUSTMENT_LIMITS,
  exportPhotoAdjustmentFromDrag,
  resolveAthletePhotoAdjustment,
  STORY_EXPORT_LAYOUT_MODES,
} from "@/lib/leaderboard/photo-adjustments";
import { buildLeaderboardRows } from "@/lib/leaderboard/ranking";
import type { AthleteMovement, LeaderboardStory } from "@/lib/leaderboard/story";
import {
  OUTPUT_DIMENSIONS,
  type ExportLayoutMode,
  type ExportPhotoAdjustment,
  type ExportPhotoAdjustments,
  type LeaderboardSpec,
  type MetricType,
  type OutputFormat,
  type RankedAthlete,
  type SportType,
} from "@/lib/leaderboard/types";
import { displayWeekLabel, STORY_FORMAT } from "@/lib/leaderboard/dashboard-state";
import { defaultExportPhotoAdjustment, type ExportAthleteSelection, type ExportAthleteSelectionOption } from "@/lib/leaderboard/export-client";
import type { LeaderboardWeekSnapshot } from "@/lib/leaderboard/week-snapshots";
import { cn } from "@/lib/utils";
import { useModalA11y } from "@/hooks/useModalA11y";

export function buttonClassName(className?: string) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100",
    className,
  );
}

export function inputClassName(className?: string) {
  return cn(
    "w-full rounded-xl border border-secondary-sand/70 bg-white px-3 py-2.5 text-sm font-medium text-primary-charcoal outline-none transition placeholder:text-primary-charcoal/35 focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100",
    className,
  );
}

export function fieldLabelClassName() {
  return "grid gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary-charcoal/55 dark:text-gray-400";
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-secondary-sand bg-white/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/55">
      <p className="font-poppins text-xl font-semibold text-primary-charcoal dark:text-gray-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-primary-charcoal/60 dark:text-gray-400">{message}</p>
    </div>
  );
}

const RANK_MEDAL_TONE: Record<number, { bg: string; ring: string; text: string }> = {
  1: { bg: "bg-[#FFC400]/15 dark:bg-[#FFC400]/10", ring: "ring-[#FFC400]/45", text: "text-[#8A6200] dark:text-[#FFD666]" },
  2: { bg: "bg-zinc-400/15 dark:bg-zinc-300/10", ring: "ring-zinc-400/45", text: "text-zinc-600 dark:text-zinc-300" },
  3: { bg: "bg-[#C47B35]/15 dark:bg-[#C47B35]/10", ring: "ring-[#C47B35]/45", text: "text-[#8A5321] dark:text-[#E3A76F]" },
};

export function RankBadge({ rank, size = "md" }: { rank?: number; size?: "md" | "sm" }) {
  if (!rank) {
    return <span className="font-poppins text-lg font-bold text-primary-charcoal/40 dark:text-gray-500">—</span>;
  }

  const tone = RANK_MEDAL_TONE[rank];
  if (!tone) {
    return <span className="font-poppins text-lg font-black text-primary-brown dark:text-secondary-sand">#{rank}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-poppins font-black ring-1",
        size === "sm" ? "px-2 py-0.5 text-sm" : "px-2.5 py-1 text-base",
        tone.bg,
        tone.ring,
        tone.text,
      )}
    >
      #{rank}
    </span>
  );
}

const categoryIcons: Record<LeaderboardCategoryId, LucideIcon> = {
  running: Footprints,
  running_elevation_gain: Footprints,
  cycling: Bike,
  swimming: Waves,
  weight_training: Dumbbell,
};

export interface CategorySummary {
  athleteCount: number;
  metric: MetricType;
  total: number;
}

function metricTableColumnLabel(metric: MetricType): string {
  if (metric === "time_minutes") {
    return "Waktu";
  }

  if (metric === "elevation_m") {
    return "Elevasi";
  }

  return "Jarak";
}

export function CategorySwitch({
  metrics,
  selectedCategory,
  sportOptions,
  summaries = {},
  onMetricSelect,
  onSportSelect,
  isLoading = false,
  hasError = false,
}: {
  metrics: LeaderboardMetricOption[];
  selectedCategory: LeaderboardCategoryId;
  sportOptions: LeaderboardSportOption[];
  summaries?: Partial<Record<LeaderboardCategoryId, CategorySummary>>;
  onMetricSelect: (category: LeaderboardCategoryId) => void;
  onSportSelect: (sport: SportType) => void;
  isLoading?: boolean;
  hasError?: boolean;
}) {
  const selectedCategoryConfig = categoryConfigForId(selectedCategory);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = sportOptions.findIndex((option) => option.sportType === selectedCategoryConfig.sportType);
    if (currentIndex < 0) {
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) {
      return;
    }

    event.preventDefault();
    const nextIndex = (currentIndex + direction + sportOptions.length) % sportOptions.length;
    onSportSelect(sportOptions[nextIndex].sportType);
  }

  return (
    <section aria-label="Pilih kompetisi olahraga" className="relative z-20 -mt-9 md:-mt-10">
      <div
        className="flex min-h-[82px] overflow-x-auto rounded-[1.5rem] border border-secondary-sand/70 bg-white/94 p-2 shadow-[0_18px_48px_rgb(90,46,23,0.12)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/94"
        onKeyDown={handleKeyDown}
        role="tablist"
      >
        {sportOptions.map((option) => {
          const isActive = selectedCategoryConfig.sportType === option.sportType;
          const displayCategoryId = isActive ? selectedCategory : option.defaultCategoryId;
          const category = categoryConfigForId(displayCategoryId);
          const Icon = categoryIcons[option.defaultCategoryId];
          const summary = summaries[displayCategoryId];
          const metric = summary?.metric ?? category.metric;
          const total = formatMetricValue(summary?.total, metric);
          const athletes = summary?.athleteCount ?? 0;

          return (
            <button
              aria-selected={isActive}
              className={cn(
                "group relative grid min-w-[230px] shrink-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-[1.15rem] px-5 py-4 text-left transition duration-300 focus:outline-none focus:ring-2 focus:ring-primary-green/30 md:min-w-0 md:flex-1",
                isActive
                  ? "bg-primary-brown text-white shadow-[0_16px_38px_rgb(90,46,23,0.24)] md:flex-[1.35]"
                  : "border-r border-secondary-sand/70 bg-white text-primary-charcoal last:border-r-0 hover:bg-primary-beige/70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-100 dark:hover:bg-zinc-800",
              )}
              key={option.sportType}
              onClick={() => onSportSelect(option.sportType)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-2xl transition",
                  isActive ? "bg-white/14 text-white" : "bg-secondary-sand/35 text-primary-brown dark:bg-zinc-800 dark:text-secondary-sand",
                )}
              >
                <Icon className="size-6" />
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-[11px] font-black uppercase tracking-[0.26em]",
                    isActive ? "text-white" : "text-primary-brown dark:text-secondary-sand",
                  )}
                >
                  {option.sportLabel}
                </span>
                {isLoading ? (
                  <span
                    className={cn("mt-1.5 block h-3.5 w-24 animate-pulse rounded-full", isActive ? "bg-white/25" : "bg-secondary-sand/60 dark:bg-zinc-700")}
                  />
                ) : (
                  <span className={cn("mt-1 block text-sm font-bold", isActive ? "text-white/82" : "text-primary-charcoal/55 dark:text-gray-400")}>
                    {hasError ? "—" : total} <span className="px-1 opacity-50">·</span> {hasError ? "—" : athletes} atlet
                  </span>
                )}
                {isActive ? <span className="mt-3 block h-0.5 w-20 rounded-full bg-secondary-sand" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {metrics.length > 1 ? (
        <div
          aria-label="Pilih ukuran leaderboard"
          className="mt-3 inline-flex max-w-full overflow-x-auto rounded-xl border border-secondary-sand/70 bg-white/90 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"
          role="tablist"
        >
          {metrics.map((metric) => {
            const isActive = metric.categoryId === selectedCategory;

            return (
              <button
                aria-selected={isActive}
                className={cn(
                  "h-10 min-w-[8.5rem] rounded-lg px-4 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-primary-green/30",
                  isActive
                    ? "bg-primary-brown text-white shadow-[0_8px_18px_rgb(90,46,23,0.18)]"
                    : "text-primary-charcoal/62 hover:bg-secondary-sand/35 dark:text-gray-300 dark:hover:bg-zinc-800",
                )}
                key={metric.categoryId}
                onClick={() => onMetricSelect(metric.categoryId)}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                type="button"
              >
                {metric.metricLabel}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function movementBadge(movement?: AthleteMovement) {
  if (!movement || !movement.fromRank) {
    return <span className="text-primary-charcoal/65 dark:text-gray-400">-</span>;
  }

  if (movement.delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-primary-green dark:text-secondary-teal">
        <TrendingUp className="size-3.5" />+{movement.delta}
      </span>
    );
  }

  if (movement.delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-secondary-clay dark:text-secondary-sand">
        <TrendingDown className="size-3.5" />-{Math.abs(movement.delta)}
      </span>
    );
  }

  return <span className="text-primary-charcoal/40 dark:text-gray-500">-</span>;
}

function movementText(movement?: AthleteMovement) {
  if (!movement || !movement.fromRank) {
    return "stabil di papan atas";
  }

  if (movement.delta > 0) {
    return `naik ${movement.delta} posisi`;
  }

  if (movement.delta < 0) {
    return `turun ${Math.abs(movement.delta)} posisi`;
  }

  return "mempertahankan posisi";
}

function signedPosition(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `-${Math.abs(value)}`;
  }

  return "-";
}

interface LeaderboardProfileAthlete {
  athleteId?: string;
  key: string;
  metric: MetricType;
  name: string;
  normalizedName?: string;
  previousRank?: number;
  profilePhotoUrl?: string;
  rank: number;
  rankDelta: number;
  username?: string;
  value: number;
}

function publicProfileHref(athlete: Pick<LeaderboardProfileAthlete, "username">) {
  return athlete.username ? `/atlet/${encodeURIComponent(athlete.username)}` : null;
}

function profileAthleteFromRankedAthlete(
  athlete: RankedAthlete,
  metric: MetricType,
  movement?: AthleteMovement,
): LeaderboardProfileAthlete {
  const key = leaderboardAthleteKey(athlete);

  return {
    athleteId: athlete.athleteId,
    key,
    metric,
    name: athlete.name,
    normalizedName: athlete.normalizedName,
    previousRank: movement?.fromRank,
    profilePhotoUrl: resolveUsableAthletePhotoUrl(athlete.profilePhotoUrl, athlete.avatarDataUrl),
    rank: athlete.rank,
    rankDelta: movement?.delta ?? 0,
    username: athlete.username,
    value: athlete.value,
  };
}

function AthleteProfilePopover({
  athlete,
  onClose,
}: {
  athlete: LeaderboardProfileAthlete | null;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y<HTMLElement>(Boolean(athlete), onClose);

  if (!athlete) {
    return null;
  }

  const href = publicProfileHref(athlete);
  const imageSrc = resolveUsableAthletePhotoUrl(athlete.profilePhotoUrl);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-primary-charcoal/72 px-4 py-8 backdrop-blur-sm" data-testid="leaderboard-athlete-popover">
      <section
        aria-label={`Detail profil ${athlete.name}`}
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-secondary-sand/60 bg-primary-beige shadow-2xl dark:border-zinc-700 dark:bg-[#121212]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-4 border-b border-secondary-sand/70 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Profil Atlet</p>
            <h2 className="mt-1 truncate font-poppins text-2xl font-black text-primary-charcoal dark:text-white">{athlete.name}</h2>
          </div>
          <button
            aria-label="Tutup detail profil atlet"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid gap-5 p-5">
          <div className="flex items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-green/15 text-xl font-black text-primary-green ring-1 ring-primary-green/20">
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={imageSrc} />
              ) : (
                initialsForName(athlete.name)
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-primary-charcoal dark:text-gray-100">@{athlete.username ?? athlete.normalizedName ?? "profil-belum-terhubung"}</p>
              <p className="mt-1 text-sm font-semibold text-primary-charcoal/58 dark:text-gray-400">
                {athlete.username ? "Terhubung dengan database atlet." : "Profil publik belum tersedia untuk atlet ini."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-secondary-sand/70 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">Rank</p>
              <p className="mt-1 font-poppins text-xl font-black text-primary-charcoal dark:text-white">#{athlete.rank}</p>
            </div>
            <div className="rounded-xl border border-secondary-sand/70 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">Nilai</p>
              <p className="mt-1 truncate font-poppins text-lg font-black text-primary-charcoal dark:text-white">
                {formatMetricValue(athlete.value, athlete.metric)}
              </p>
            </div>
            <div className="rounded-xl border border-secondary-sand/70 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">Gerak</p>
              <p className="mt-1 font-poppins text-xl font-black text-primary-charcoal dark:text-white">{signedPosition(athlete.rankDelta)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {href ? (
              <Link
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-brown px-4 text-sm font-black text-white transition hover:bg-primary-brown/90"
                href={href}
              >
                Lihat profil
              </Link>
            ) : null}
            <button
              className="inline-flex h-11 items-center justify-center rounded-xl border border-secondary-sand bg-white px-4 text-sm font-black text-primary-charcoal transition hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
              onClick={onClose}
              type="button"
            >
              Tutup
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 112;
  const height = 32;
  const padding = 4;

  if (values.length < 2) {
    return <span className="text-xs font-bold text-primary-charcoal/65 dark:text-gray-400">Belum cukup data</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    value,
    x: padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPoint = points[points.length - 1];

  return (
    <svg className="h-8 w-28" viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke="#5A2E17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      {points.map((point, index) => (
        <circle cx={point.x} cy={point.y} fill="transparent" key={index} r={6}>
          <title>{point.value}</title>
        </circle>
      ))}
      <circle cx={lastPoint.x} cy={lastPoint.y} fill="#5E7A5E" r="3" />
    </svg>
  );
}

export function LeaderboardCardShell({
  actionSlot,
  children,
  exportDisabled,
  onExport,
  onRefresh,
  refreshing,
  searchValue,
  subtitle,
  title = "Peringkat Atlet",
  toolbar,
  onSearchChange,
}: {
  actionSlot?: ReactNode;
  children: ReactNode;
  exportDisabled?: boolean;
  onExport?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  searchValue?: string;
  subtitle?: string;
  title?: string;
  toolbar?: ReactNode;
  onSearchChange?: (value: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-secondary-sand/60 bg-white shadow-[0_18px_48px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-secondary-sand/50 px-5 py-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-charcoal/45 dark:text-gray-500">Klasemen Minggu Ini</p>
          <h2 className="font-poppins text-2xl font-black tracking-[-0.03em] text-primary-charcoal dark:text-gray-100">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {onSearchChange ? (
            <label className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-charcoal/35 dark:text-gray-500" />
              <input
                className={inputClassName("h-10 pl-10")}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Cari atlet..."
                value={searchValue ?? ""}
              />
            </label>
          ) : null}
          {subtitle ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-bold text-primary-charcoal/65 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300">
              <CalendarDays className="size-4" />
              {subtitle}
            </span>
          ) : null}
          {onRefresh ? (
            <button
              className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
              disabled={refreshing}
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Segarkan
            </button>
          ) : null}
          {onExport ? (
            <button
              className={buttonClassName("h-10 bg-primary-brown text-white shadow-[0_10px_24px_rgb(90,46,23,0.16)] hover:bg-primary-brown/90")}
              disabled={exportDisabled}
              onClick={onExport}
              type="button"
            >
              <Download className="size-4" />
              Unduh gambar
            </button>
          ) : null}
          {actionSlot}
        </div>
      </div>
      {toolbar ? <div className="border-b border-secondary-sand/50 px-5 py-4 dark:border-zinc-800">{toolbar}</div> : null}
      {children}
    </section>
  );
}

export function LeaderboardTable({
  embedded = false,
  highlightedKey,
  movementByAthleteKey = {},
  onAthleteHover,
  onExport,
  onRefresh,
  periodNavigation,
  refreshing,
  snapshots = [],
  spec,
  subtitle,
}: {
  embedded?: boolean;
  highlightedKey?: string | null;
  movementByAthleteKey?: Record<string, AthleteMovement>;
  onAthleteHover?: (key: string | null) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  periodNavigation?: ReactNode;
  refreshing?: boolean;
  snapshots?: LeaderboardWeekSnapshot[];
  spec: LeaderboardSpec;
  subtitle?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileAthlete, setSelectedProfileAthlete] = useState<LeaderboardProfileAthlete | null>(null);
  const rankedAthletes = buildLeaderboardRows(spec.athletes, Math.max(10, spec.athletes.length));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAthletes = normalizedQuery
    ? rankedAthletes.filter((athlete) => athlete.name.toLowerCase().includes(normalizedQuery))
    : rankedAthletes;
  const athletes = filteredAthletes;
  const trendByAthlete = useMemo(() => {
    const trends = new Map<string, number[]>();
    snapshots.slice(-5).forEach((snapshot) => {
      buildLeaderboardRows(snapshot.spec.athletes, Math.max(10, snapshot.spec.athletes.length)).forEach((athlete) => {
        const key = leaderboardAthleteKey(athlete);
        trends.set(key, [...(trends.get(key) ?? []), athlete.value]);
      });
    });
    return trends;
  }, [snapshots]);

  function onAthleteOpen(athlete: LeaderboardProfileAthlete) {
    setSelectedProfileAthlete(athlete);
  }

  const tableBody = !rankedAthletes.length ? (
    <div className="p-5">
      <EmptyState title="Belum ada peringkat" message="Peringkat akan muncul setelah data minggu ini siap." />
    </div>
  ) : !athletes.length ? (
    <div className="p-5">
      <EmptyState title="Anggota tidak ditemukan" message="Coba kata kunci lain untuk mencari anggota di klasemen ini." />
    </div>
  ) : (
    <div className="overflow-hidden rounded-[1.35rem] border border-secondary-sand/60 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="max-h-[560px] w-full overflow-auto">
        <table className="w-full min-w-[860px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[80px]" />
            <col className="w-[320px]" />
            <col className="w-[160px]" />
            <col className="w-[130px]" />
            <col className="w-[170px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-secondary-sand/50 bg-white text-xs font-black uppercase tracking-[0.08em] text-primary-charcoal/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-500">
              <th className="sticky left-0 z-30 whitespace-nowrap bg-inherit px-5 py-4 text-left">Peringkat</th>
              <th className="sticky left-[80px] z-30 whitespace-nowrap bg-inherit px-5 py-4 text-left">Anggota</th>
              <th className="whitespace-nowrap px-5 py-4 text-right">{metricTableColumnLabel(spec.metric)}</th>
              <th className="whitespace-nowrap px-5 py-4 text-center">Perubahan</th>
              <th className="whitespace-nowrap px-5 py-4 text-left">Tren</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => {
              const key = leaderboardAthleteKey(athlete);
              const isHighlighted = highlightedKey === key;
              const movement = movementByAthleteKey[key];
              const values = trendByAthlete.get(key) ?? [];
              const imageSrc = resolveUsableAthletePhotoUrl(athlete.profilePhotoUrl, athlete.avatarDataUrl);
              const profileAthlete = profileAthleteFromRankedAthlete(athlete, spec.metric, movement);

              return (
                <tr
                  className={cn(
                    "border-b border-secondary-sand/35 bg-white transition last:border-b-0 dark:border-zinc-800 dark:bg-zinc-900",
                    isHighlighted ? "bg-secondary-sand/45 dark:bg-zinc-800" : "hover:bg-primary-beige/45 dark:hover:bg-zinc-800/55",
                  )}
                  data-leaderboard-athlete-key={key}
                  key={athlete.id}
                  onMouseEnter={() => onAthleteHover?.(key)}
                  onMouseLeave={() => onAthleteHover?.(null)}
                >
                  <td className="sticky left-0 z-20 whitespace-nowrap bg-inherit px-5 py-4">
                    <RankBadge rank={athlete.rank} />
                  </td>
                  <td className="sticky left-[80px] z-20 bg-inherit px-5 py-4">
                    <button
                      aria-label={`Buka profil ${athlete.name}`}
                      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl text-left transition focus:outline-none focus:ring-2 focus:ring-primary-green/30"
                      onBlur={() => onAthleteHover?.(null)}
                      onClick={() => onAthleteOpen(profileAthlete)}
                      onFocus={() => onAthleteHover?.(key)}
                      type="button"
                    >
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary-sand/70 text-[11px] font-black text-primary-brown ring-1 ring-primary-brown/10 dark:bg-zinc-800 dark:text-secondary-sand">
                        {imageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`${athlete.name} avatar`}
                            className="h-full w-full object-cover"
                            src={imageSrc}
                          />
                        ) : (
                          initialsForName(athlete.name)
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-primary-charcoal dark:text-gray-100">{athlete.name}</span>
                        {athlete.username ? (
                          <span className="mt-0.5 hidden truncate text-[11px] font-black text-primary-charcoal/38 dark:text-gray-500 sm:block">@{athlete.username}</span>
                        ) : null}
                      </span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-primary-brown/35 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-secondary-sand/55" />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-black text-primary-charcoal dark:text-gray-100">
                    {formatMetricValue(athlete.value, spec.metric)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-center text-sm font-black">{movementBadge(movement)}</td>
                  <td className="px-5 py-4"><Sparkline values={values} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tableContent = (
    <div className={cn("min-w-0 space-y-4", !embedded && "p-5")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Klasemen Minggu Ini</p>
          <h3 className="mt-1 font-poppins text-2xl font-black tracking-[-0.03em] text-primary-charcoal dark:text-gray-100">Peringkat Atlet</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-charcoal/35 dark:text-gray-500" />
            <input
              className={inputClassName("h-10 pl-10")}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari atlet..."
              value={searchQuery}
            />
          </label>
          {periodNavigation ? <div className="flex justify-start sm:justify-center">{periodNavigation}</div> : null}
          {onRefresh ? (
            <button
              className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
              disabled={refreshing}
              onClick={onRefresh}
              type="button"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Segarkan
            </button>
          ) : null}
          {onExport ? (
            <button
              className={buttonClassName("h-10 bg-primary-brown text-white shadow-[0_10px_24px_rgb(90,46,23,0.16)] hover:bg-primary-brown/90")}
              disabled={!spec.athletes.length}
              onClick={onExport}
              type="button"
            >
              <Download className="size-4" />
              Unduh gambar
            </button>
          ) : null}
        </div>
      </div>
      {tableBody}
      {!normalizedQuery && rankedAthletes.length > 10 ? (
        <p className="text-sm font-bold text-primary-charcoal/55 dark:text-gray-400">
          Menampilkan semua {rankedAthletes.length} anggota yang diinput.
        </p>
      ) : null}
      <AthleteProfilePopover athlete={selectedProfileAthlete} onClose={() => setSelectedProfileAthlete(null)} />
    </div>
  );

  if (embedded) {
    return tableContent;
  }

  return (
    <LeaderboardCardShell subtitle={subtitle} title="Peringkat Atlet">
      {tableContent}
    </LeaderboardCardShell>
  );
}

export function LeaderboardStoryHero({
  athleteCount,
  categoryLabel,
  story,
  spec,
  total,
  totalLabel,
}: {
  athleteCount?: number;
  categoryLabel: string;
  onExport?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  story: LeaderboardStory;
  spec: LeaderboardSpec;
  total: number;
  totalLabel: string;
}) {
  const leader = story.leader;
  const activeAthletes = athleteCount ?? story.athleteCount ?? spec.athletes.length;
  const weekLabel = String(spec.weekNumber).toUpperCase().startsWith("WEEK") ? String(spec.weekNumber).toUpperCase() : `WEEK ${spec.weekNumber}`;
  const delta = calculateWeeklyComparison(total, story.previousTotal);
  const average = activeAthletes ? total / activeAthletes : 0;
  const storyLines = [
    story.topMover ? `${story.topMover.name} naik paling tinggi, melompat ${story.topMover.delta} posisi.` : "Belum ada kenaikan peringkat besar minggu ini.",
    story.biggestDrop ? `${story.biggestDrop.name} turun paling jauh, ${Math.abs(story.biggestDrop.delta)} posisi.` : "Belum ada penurunan peringkat besar minggu ini.",
    leader && story.leaderStreak && story.leaderStreak > 1
      ? `${leader.name} bertahan di posisi 1 selama ${story.leaderStreak} minggu berturut-turut.`
      : "Perebutan posisi 1 masih terbuka.",
    `${activeAthletes} atlet ikut aktif berkompetisi minggu ini.`,
  ];

  return (
    <section className="topbar-clearance relative overflow-hidden border-b border-secondary-sand/60 bg-[#f7f3ee] dark:border-zinc-800 dark:bg-[#121212]">
      <div className="grid w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 gap-8 pb-14 lg:grid-cols-[minmax(0,0.98fr)_minmax(430px,1.02fr)] lg:items-stretch">
        <div className="relative z-10 py-3 md:py-8">
          <p className="mb-5 text-xs font-black uppercase tracking-[0.28em] text-primary-green dark:text-secondary-teal">
            {categoryLabel} <span className="px-2 text-primary-brown/45 dark:text-secondary-sand/45">·</span> {weekLabel}
          </p>
          <h1 className="max-w-3xl font-poppins text-5xl font-black leading-[0.96] tracking-[-0.05em] text-primary-charcoal dark:text-gray-100 sm:text-6xl lg:text-7xl">
            {leader ? (
              <>
                {leader.name}
                <span className="block text-primary-brown dark:text-secondary-sand">leads the pack.</span>
              </>
            ) : (
              <>
                Weekly race report
                <span className="block text-primary-brown dark:text-secondary-sand">starts here.</span>
              </>
            )}
          </h1>
          <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-primary-charcoal/68 dark:text-gray-300 md:text-lg">
            {leader
              ? `Memimpin dengan ${formatMetricValue(leader.value, spec.metric)} dan ${movementText(story.leaderMovement)}. ${story.leaderStreak && story.leaderStreak > 1 ? `Bertahan di posisi #1 selama ${story.leaderStreak} minggu berturut-turut.` : "Tekanannya mulai terasa di barisan depan."}`
              : "Import aktivitas mingguan untuk menghidupkan cerita performa komunitas."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4 border-y border-secondary-sand/70 py-5 dark:border-zinc-800">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">{totalLabel}</p>
              <p className="mt-1 font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">{formatMetricValue(total, spec.metric)}</p>
              <p className="mt-1 text-xs font-bold text-primary-green dark:text-secondary-teal">{delta} dari minggu lalu</p>
            </div>
            <div className="h-12 w-px bg-secondary-sand/80 dark:bg-zinc-800" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">Anggota aktif</p>
              <p className="mt-1 font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">{activeAthletes}</p>
              <p className="mt-1 text-xs font-bold text-primary-charcoal/45 dark:text-gray-500">Bergabung minggu ini</p>
            </div>
            <div className="h-12 w-px bg-secondary-sand/80 dark:bg-zinc-800" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">Rata-rata aktivitas</p>
              <p className="mt-1 font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">{formatMetricValue(average, spec.metric)}</p>
              <p className="mt-1 text-xs font-bold text-primary-charcoal/45 dark:text-gray-500">Per atlet minggu ini</p>
            </div>
          </div>
        </div>

        <div className="relative min-h-[390px] overflow-hidden rounded-[2rem] border border-white/70 shadow-[0_30px_70px_rgb(90,46,23,0.16)] dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Runner on a mountain trail" className="absolute inset-0 h-full w-full object-cover" src="/leaderboard-hero.svg" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f7f3ee]/15 via-transparent to-primary-brown/8 dark:from-zinc-950/20" />
          <div className="absolute right-6 top-6 hidden w-72 rounded-[1.4rem] border border-white/65 bg-white/84 p-5 shadow-[0_18px_42px_rgb(90,46,23,0.16)] backdrop-blur md:block dark:border-zinc-700 dark:bg-zinc-900/78">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.22em] text-primary-charcoal/55 dark:text-gray-500">
              This Week Story
            </p>
            <div className="grid gap-3">
              {storyLines.map((line, index) => (
                <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3" key={line}>
                  <span className="grid size-7 place-items-center rounded-full bg-primary-beige text-xs font-black text-primary-brown dark:bg-zinc-800 dark:text-secondary-sand">
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold leading-5 text-primary-charcoal/78 dark:text-gray-200">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MovementNarrative({ metric, story }: { metric: LeaderboardSpec["metric"]; story: LeaderboardStory }) {
  const leader = story.leader;
  const insightLines = [
    leader
      ? `${leader.name} memimpin klasemen dengan ${formatMetricValue(leader.value, metric)}${story.leaderStreak && story.leaderStreak > 1 ? `, sudah ${story.leaderStreak} minggu berturut-turut di posisi 1.` : "."}`
      : "Belum ada pemimpin klasemen minggu ini.",
    story.topMover
      ? `${story.topMover.name} naik paling tinggi minggu ini, melompat ${story.topMover.delta} posisi.`
      : "Belum ada kenaikan peringkat besar minggu ini.",
    story.biggestDrop
      ? `${story.biggestDrop.name} turun paling jauh minggu ini, ${Math.abs(story.biggestDrop.delta)} posisi.`
      : "Belum ada penurunan peringkat besar minggu ini.",
    story.athleteCount
      ? `${story.athleteCount} atlet aktif berkompetisi minggu ini.`
      : "Data aktivitas komunitas akan muncul setelah ada snapshot minggu ini.",
  ];
  const movers = story.topMover
    ? [{ key: story.topMover.key, name: story.topMover.name, delta: story.topMover.delta, fromRank: story.topMover.fromRank ?? story.topMover.toRank, toRank: story.topMover.toRank }]
    : [];
  const drops = story.biggestDrop
    ? [{ key: story.biggestDrop.key, name: story.biggestDrop.name, delta: story.biggestDrop.delta, fromRank: story.biggestDrop.fromRank ?? story.biggestDrop.toRank, toRank: story.biggestDrop.toRank }]
    : [];

  return (
    <aside className="rounded-[1.45rem] border border-secondary-sand/70 bg-white/86 p-5 shadow-[0_18px_48px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900/86">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-green dark:text-secondary-teal">Cerita Komunitas</p>
        <h3 className="mt-2 font-poppins text-2xl font-black tracking-[-0.04em] text-primary-charcoal dark:text-gray-100">Minggu Ini</h3>
        <ol className="mt-5 grid gap-3">
          {insightLines.map((line, index) => (
            <li className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 text-sm font-semibold leading-6 text-primary-charcoal/72 dark:text-gray-300" key={line}>
              <span className="font-poppins text-base font-black text-primary-brown/45 dark:text-secondary-sand/45">0{index + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-5 border-t border-secondary-sand/70 pt-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-poppins text-lg font-black text-primary-charcoal dark:text-gray-100">Naik Paling Banyak</h3>
          <TrendingUp className="size-5 text-primary-green dark:text-secondary-teal" />
        </div>
        <ol className="mt-4 grid gap-3">
          {movers.length ? movers.slice(0, 3).map((item, index) => (
            <li className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 text-sm font-bold" key={item.key}>
              <span className="text-primary-charcoal/45 dark:text-gray-500">{index + 1}</span>
              <span className="truncate text-primary-charcoal dark:text-gray-100">{item.name}</span>
              <span className="text-primary-green dark:text-secondary-teal">{signedPosition(item.delta)}</span>
            </li>
          )) : (
            <li className="text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">Belum ada kenaikan besar.</li>
          )}
        </ol>
      </section>

      <section className="mt-5 border-t border-secondary-sand/70 pt-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-poppins text-lg font-black text-primary-charcoal dark:text-gray-100">Turun Paling Jauh</h3>
          <TrendingDown className="size-5 text-secondary-clay dark:text-secondary-sand" />
        </div>
        <ol className="mt-4 grid gap-3">
          {drops.length ? drops.slice(0, 3).map((item, index) => (
            <li className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 text-sm font-bold" key={item.key}>
              <span className="text-primary-charcoal/45 dark:text-gray-500">{index + 1}</span>
              <span className="truncate text-primary-charcoal dark:text-gray-100">{item.name}</span>
              <span className="text-secondary-clay dark:text-secondary-sand">{signedPosition(item.delta)}</span>
            </li>
          )) : (
            <li className="text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">Tidak ada penurunan besar.</li>
          )}
        </ol>
      </section>

      <section className="relative mt-5 overflow-hidden border-t border-secondary-sand/70 pt-5 dark:border-zinc-800">
        <div className="absolute -bottom-10 -right-8 size-32 rounded-full border border-secondary-sand/60 opacity-50" />
        <h3 className="font-poppins text-lg font-black text-primary-charcoal dark:text-gray-100">Ingin naik peringkat?</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-primary-charcoal/62 dark:text-gray-400">
          Konsisten bergerak, catat aktivitasmu, dan jadi bagian dari kompetisi sehat Altruist Sehat.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary-brown px-4 text-sm font-bold text-white transition hover:bg-primary-brown/90"
          href="/event"
        >
          Lihat Kegiatan
        </Link>
      </section>
    </aside>
  );
}

function athleteColorIndex(key: string, paletteSize: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % paletteSize;
}

function svgIdSuffix(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function BumpChart({
  actionSlot,
  data,
  highlightedKey,
  leaderboard,
  onHighlightChange,
  rangeLabel,
  toolbar,
}: {
  actionSlot?: ReactNode;
  data: BumpChartData;
  highlightedKey?: string | null;
  leaderboard?: ReactNode;
  onHighlightChange?: (key: string | null) => void;
  rangeLabel?: string;
  toolbar?: ReactNode;
}) {
  type ChartSeries = BumpChartData["series"][number];
  type ChartPoint = ChartSeries["points"][number];

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    series: ChartSeries;
    point: ChartPoint;
    weekLabel: string;
    previousRank?: number;
    x: number;
    y: number;
  } | null>(null);
  const [selectedProfileAthlete, setSelectedProfileAthlete] = useState<LeaderboardProfileAthlete | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  const width = Math.max(1120, data.weeks.length * 190);
  const padding = { top: 34, right: 88, bottom: 66, left: 78 };
  const colors = ["#FFC400", "#7EC8C1", "#60A5FA", "#F472B6", "#A3E635", "#F97316", "#C084FC", "#2DD4BF", "#FDE68A", "#FB7185", "#93C5FD", "#D9F99D"];
  const dashPatterns = ["", "9 5", "2 5", "12 4 2 4"];
  const activeKey = hoveredKey ?? selectedKey ?? highlightedKey ?? null;
  const selectedSeries = activeKey ? data.series.find((series) => series.key === activeKey) : undefined;
  const visibleSeries = useMemo(() => {
    if (selectedSeries && !data.series.some((series) => series.key === selectedSeries.key)) {
      return [...data.series, selectedSeries].sort((left, right) => left.latestRank - right.latestRank);
    }

    return data.series;
  }, [data.series, selectedSeries]);

  const occupiedRanks = data.series.flatMap((series) => series.points.map((point) => point.rank)).filter((rank): rank is number => rank !== null);
  const maxOccupiedRank = occupiedRanks.length ? Math.max(...occupiedRanks) : data.maxRank;
  const maxDisplayedRank = Math.min(data.maxRank, Math.max(5, maxOccupiedRank));
  const rankGapPx = maxDisplayedRank > 80 ? 34 : maxDisplayedRank > 40 ? 38 : 48;
  const height = Math.max(520, maxDisplayedRank * rankGapPx);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xForWeek = (index: number) => padding.left + (data.weeks.length === 1 ? innerWidth / 2 : (index / (data.weeks.length - 1)) * innerWidth);
  const yForRank = (rank: number) => padding.top + ((rank - 1) / Math.max(1, maxDisplayedRank - 1)) * innerHeight;
  const monthGroups = data.weeks.reduce<Array<{ key: string; label: string; startIndex: number; endIndex: number }>>((groups, week, index) => {
    const current = groups[groups.length - 1];

    if (current && current.key === week.monthKey) {
      current.endIndex = index;
      return groups;
    }

    groups.push({
      key: week.monthKey,
      label: week.monthLabel,
      startIndex: index,
      endIndex: index,
    });
    return groups;
  }, []);
  const weekIndex = new Map(data.weeks.map((week, index) => [week.key, index]));
  const weekMeta = new Map(data.weeks.map((week) => [week.key, week]));
  const historyRangeLabel = data.weeks.length
    ? `${data.weeks[0].periodStartLabel} – ${data.weeks[data.weeks.length - 1].periodEndLabel}`
    : "";
  const chartRangeLabel = rangeLabel ?? `${data.weeks.length} Minggu Terakhir`;
  const latestWeekKey = data.weeks.at(-1)?.key;
  const tooltipWidth = 260;

  if (!data.weeks.length || !data.series.length) {
    return (
      <div className="min-w-0 rounded-[1.75rem] border border-secondary-sand/60 bg-white p-4 shadow-[0_18px_48px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 border-b border-secondary-sand/60 pb-4 dark:border-zinc-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-poppins text-3xl font-black tracking-[-0.04em] text-primary-charcoal dark:text-gray-100 md:text-4xl">
                Perebutan Puncak
              </h2>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">
                {chartRangeLabel} · {historyRangeLabel || "Belum ada histori"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {actionSlot}
            </div>
          </div>
          {toolbar ? <div className="rounded-2xl border border-secondary-sand/60 bg-primary-beige/45 p-4 dark:border-zinc-800 dark:bg-zinc-950/35">{toolbar}</div> : null}
        </div>
        <div className="mt-4">
          <EmptyState title="Cerita peringkat belum tersedia" message="Data beberapa minggu akan membentuk pergerakan peringkat anggota di sini." />
        </div>
        {leaderboard ? <div className="mt-5 border-t border-secondary-sand/60 pt-5 dark:border-zinc-800">{leaderboard}</div> : null}
      </div>
    );
  }

  const axisStep = maxDisplayedRank <= 10 ? 1 : maxDisplayedRank <= 20 ? 2 : maxDisplayedRank <= 50 ? 5 : 10;
  const axisRanks = Array.from({ length: Math.ceil(maxDisplayedRank / axisStep) + 1 }, (_, index) => 1 + index * axisStep)
    .filter((rank) => rank <= maxDisplayedRank)
    .concat(maxDisplayedRank)
    .filter((rank, index, array) => array.indexOf(rank) === index);
  const gridRanks = Array.from({ length: maxDisplayedRank }, (_, index) => index + 1);

  function pointsForSeries(series: ChartSeries) {
    return series.points
      .map((point) => {
        const index = weekIndex.get(point.weekKey);
        if (index === undefined) {
          return undefined;
        }

        return { ...point, x: xForWeek(index), y: point.rank === null ? null : yForRank(point.rank) };
      })
      .filter((point): point is ChartPoint & { x: number; y: number | null } => Boolean(point));
  }

  function rankedSegments(points: Array<ChartPoint & { x: number; y: number | null }>) {
    const segments: Array<Array<ChartPoint & { x: number; y: number }>> = [];
    let current: Array<ChartPoint & { x: number; y: number }> = [];

    points.forEach((point) => {
      if (point.rank === null || point.y === null) {
        if (current.length) {
          segments.push(current);
          current = [];
        }
        return;
      }

      current.push({ ...point, rank: point.rank, y: point.y });
    });

    if (current.length) {
      segments.push(current);
    }

    return segments;
  }

  function curvedPath(points: Array<{ x: number; y: number }>) {
    if (!points.length) return "";

    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const midX = previous.x + (point.x - previous.x) / 2;
      return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
    }, "");
  }

  function previousRankForPoint(series: ChartSeries, point: ChartPoint) {
    const pointIndex = series.points.findIndex((item) => item.weekKey === point.weekKey);
    const previousRank = pointIndex > 0 ? series.points[pointIndex - 1]?.rank : undefined;
    return previousRank === null ? undefined : previousRank;
  }

  function isInteractiveChartTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, [role='button'], [data-chart-tooltip]"));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isInteractiveChartTarget(event.target)) {
      return;
    }

    panRef.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!panRef.current) {
      return;
    }

    event.currentTarget.scrollLeft = panRef.current.scrollLeft - (event.clientX - panRef.current.x);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    panRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function rankMovementTooltip(previousRank: number | undefined, currentRank: number | null) {
    if (currentRank === null) {
      return "Tidak masuk peringkat";
    }

    if (!previousRank) {
      return "Baru masuk peringkat";
    }

    const delta = previousRank - currentRank;

    if (delta > 0) {
      return `Naik ${delta} posisi`;
    }

    if (delta < 0) {
      return `Turun ${Math.abs(delta)} posisi`;
    }

    return "Tetap di posisi yang sama";
  }

  function showTooltip(series: ChartSeries, point: ChartPoint & { x: number; y: number }) {
    setTooltip({
      series,
      point,
      weekLabel: weekMeta.get(point.weekKey)?.periodLabel ?? "Periode belum tersedia",
      previousRank: previousRankForPoint(series, point),
      x: point.x,
      y: point.y,
    });
  }

  function profileAthleteFromSeries(series: ChartSeries): LeaderboardProfileAthlete {
    return {
      athleteId: series.athleteId,
      key: series.key,
      metric: series.metric,
      name: series.name,
      normalizedName: series.normalizedName,
      previousRank: series.previousRank,
      profilePhotoUrl: series.profilePhotoUrl,
      rank: series.latestRank,
      rankDelta: series.rankDelta,
      username: series.username,
      value: series.latestValue,
    };
  }

  function onAthleteOpen(athlete: LeaderboardProfileAthlete) {
    setSelectedProfileAthlete(athlete);
  }

  function focusChartAthlete(key: string) {
    setSelectedKey(key);
    setHoveredKey(key);
    onHighlightChange?.(key);
  }

  function clearChartAthleteFocus() {
    setHoveredKey(null);
    onHighlightChange?.(null);
  }

  function handleAthleteKeyDown(event: KeyboardEvent<SVGElement>, athlete: LeaderboardProfileAthlete) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onAthleteOpen(athlete);
  }

  function zoneRect(startRank: number, endRank: number, className: string) {
    if (startRank > maxDisplayedRank) {
      return null;
    }

    const rankGap = innerHeight / Math.max(1, maxDisplayedRank - 1);
    const top = Math.max(padding.top, yForRank(startRank) - rankGap / 2);
    const bottom = Math.min(height - padding.bottom, yForRank(Math.min(endRank, maxDisplayedRank)) + rankGap / 2);
    return <rect className={className} height={Math.max(0, bottom - top)} rx="14" width={width - padding.left - padding.right} x={padding.left} y={top} />;
  }

  return (
    <>
    <div className="min-w-0 rounded-[1.75rem] border border-secondary-sand/60 bg-white p-4 shadow-[0_18px_48px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 border-b border-secondary-sand/60 pb-4 dark:border-zinc-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-poppins text-3xl font-black tracking-[-0.04em] text-primary-charcoal dark:text-gray-100 md:text-4xl">
              Perebutan Puncak
            </h2>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">
              {chartRangeLabel} · {historyRangeLabel}
            </p>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-primary-charcoal/58 dark:text-gray-400">
              Pergerakan mingguan ditarik sebagai lintasan peringkat agar kenaikan dan penurunan setiap anggota mudah dibandingkan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {actionSlot}
          </div>
        </div>
        {toolbar ? <div className="rounded-2xl border border-secondary-sand/60 bg-primary-beige/45 p-4 dark:border-zinc-800 dark:bg-zinc-950/35">{toolbar}</div> : null}
      </div>

      <div
        className="relative mt-4 max-h-[820px] w-full cursor-grab overflow-auto rounded-2xl bg-primary-beige/45 p-3 active:cursor-grabbing dark:bg-[#070707]"
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          panRef.current = null;
          setHoveredKey(null);
          onHighlightChange?.(null);
          setTooltip(null);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={scrollRef}
      >
        <svg aria-label="Bump chart ranking atlet" className="block" role="group" style={{ minWidth: width, width: "100%" }} viewBox={`0 0 ${width} ${height}`}>
          {zoneRect(1, 1, "fill-[#F2C94C]/12 dark:fill-[#F2C94C]/18")}
          {zoneRect(2, 3, "fill-[#B7D6E6]/14 dark:fill-[#7EC8C1]/12")}
          {zoneRect(4, 5, "fill-[#C49A7C]/12 dark:fill-[#C49A7C]/10")}
          {gridRanks.map((rank) => {
            const y = yForRank(rank);
            const isLabeled = axisRanks.includes(rank);
            return (
              <g key={rank}>
                <line
                  className={rank === 1 ? "stroke-primary-brown/40 dark:stroke-white/50" : "stroke-primary-brown/22 dark:stroke-white/18"}
                  strokeDasharray={rank === 1 ? "0" : "4 7"}
                  strokeWidth={rank === 1 ? "1.5" : "1"}
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                />
                {isLabeled ? (
                  <text className="fill-primary-brown/80 dark:fill-white/72" fontSize="12" fontWeight="800" textAnchor="end" x={padding.left - 14} y={y + 4}>
                    #{rank}
                  </text>
                ) : null}
              </g>
            );
          })}
          {data.weeks.map((week, index) => {
            const x = xForWeek(index);
            return (
              <g key={week.key}>
                <line className="stroke-primary-brown/20 dark:stroke-white/20" strokeWidth="1" x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} />
              </g>
            );
          })}
          {monthGroups.map((group) => {
            const startX = xForWeek(group.startIndex);
            const endX = xForWeek(group.endIndex);
            const isSingleWeek = group.startIndex === group.endIndex;
            const lineStart = isSingleWeek ? startX - 22 : startX;
            const lineEnd = isSingleWeek ? endX + 22 : endX;
            const centerX = (startX + endX) / 2;

            return (
              <g key={group.key}>
                <line className="stroke-primary-brown/38 dark:stroke-secondary-sand/70" strokeLinecap="round" strokeWidth="2" x1={lineStart} x2={lineEnd} y1={height - 34} y2={height - 34} />
                <text className="fill-primary-brown/90 dark:fill-secondary-sand" fontSize="13" fontWeight="900" textAnchor="middle" x={centerX} y={height - 14}>
                  {group.label}
                </text>
              </g>
            );
          })}
          {visibleSeries.map((series, seriesIndex) => {
            const points = pointsForSeries(series);
            const segments = rankedSegments(points);
            const rankedPoints = segments.flat();
            const color = colors[athleteColorIndex(series.key, colors.length)];
            const dashPattern = dashPatterns[seriesIndex % dashPatterns.length];
            const isActive = activeKey === series.key;
            const hasSpotlight = Boolean(activeKey);
            const isInDisplayedRange = series.latestRank <= data.maxRank;
            const opacity = isActive ? 1 : hasSpotlight ? 0.12 : isInDisplayedRange && series.latestRank <= 5 ? 0.94 : isInDisplayedRange ? 0.54 : 0.24;
            const strokeWidth = isActive ? 5 : hasSpotlight ? 1.25 : isInDisplayedRange ? 3 : 2;
            const profileAthlete = profileAthleteFromSeries(series);

            return (
              <g key={series.key} opacity={opacity} style={{ transition: "opacity 200ms ease" }}>
                {segments.map((segment, segmentIndex) => (
                  <motion.path
                    animate={{ pathLength: 1 }}
                    aria-label={`Buka detail profil ${series.name}`}
                    d={curvedPath(segment)}
                    fill="none"
                    initial={{ pathLength: 0.82 }}
                    key={`${series.key}:segment:${segmentIndex}`}
                    onBlur={() => {
                      clearChartAthleteFocus();
                      setTooltip(null);
                    }}
                    onClick={() => onAthleteOpen(profileAthlete)}
                    onFocus={() => focusChartAthlete(series.key)}
                    onKeyDown={(event) => handleAthleteKeyDown(event, profileAthlete)}
                    onMouseEnter={() => {
                      setHoveredKey(series.key);
                      onHighlightChange?.(series.key);
                    }}
                    onMouseLeave={() => {
                      setHoveredKey(null);
                      onHighlightChange?.(null);
                    }}
                    role="button"
                    stroke={color}
                    strokeDasharray={dashPattern || undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={strokeWidth}
                    style={{ cursor: "pointer", transition: "stroke-width 200ms ease, opacity 200ms ease" }}
                    tabIndex={0}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                ))}
                {rankedPoints.map((point) => {
                  const isLatestWeekPoint = point.weekKey === latestWeekKey;
                  const endpointImageSrc = isLatestWeekPoint ? resolveUsableAthletePhotoUrl(series.profilePhotoUrl) : null;
                  const endpointClipId = `leaderboard-endpoint-avatar-clip-${svgIdSuffix(series.key)}`;
                  const endpointSize = isActive ? 34 : 30;
                  const endpointRadius = endpointSize / 2;
                  const endpointInnerSize = endpointSize - 6;

                  return (
                    <g
                      aria-label={`Buka detail profil ${series.name}`}
                      key={`${series.key}:${point.weekKey}`}
                      onBlur={() => {
                        clearChartAthleteFocus();
                        setTooltip(null);
                      }}
                      onClick={() => {
                        setSelectedKey(series.key);
                        onHighlightChange?.(series.key);
                        onAthleteOpen(profileAthlete);
                      }}
                      onFocus={() => {
                        focusChartAthlete(series.key);
                        showTooltip(series, point);
                      }}
                      onKeyDown={(event) => handleAthleteKeyDown(event, profileAthlete)}
                      onMouseEnter={() => {
                        setHoveredKey(series.key);
                        onHighlightChange?.(series.key);
                        showTooltip(series, point);
                      }}
                      onMouseLeave={() => {
                        setHoveredKey(null);
                        onHighlightChange?.(null);
                      }}
                      role="button"
                      style={{ cursor: "pointer" }}
                      tabIndex={0}
                    >
                      {isLatestWeekPoint ? (
                        <g data-testid={`leaderboard-endpoint-avatar-${series.key}`}>
                          <circle className="fill-transparent" cx={point.x} cy={point.y} r={endpointRadius + 5} />
                          <clipPath id={endpointClipId}>
                            <circle cx={point.x} cy={point.y} r={endpointInnerSize / 2} />
                          </clipPath>
                          <circle
                            className="fill-[#F7F3EE] dark:fill-[#0B0B0B]"
                            cx={point.x}
                            cy={point.y}
                            r={endpointRadius}
                            stroke={color}
                            strokeWidth={isActive ? 3.5 : 2.5}
                          />
                          {endpointImageSrc ? (
                            <image
                              clipPath={`url(#${endpointClipId})`}
                              height={endpointInnerSize}
                              href={endpointImageSrc}
                              preserveAspectRatio="xMidYMid slice"
                              width={endpointInnerSize}
                              x={point.x - endpointInnerSize / 2}
                              y={point.y - endpointInnerSize / 2}
                            />
                          ) : (
                            <text fill={color} fontSize="10" fontWeight="900" textAnchor="middle" x={point.x} y={point.y + 3.5}>
                              {initialsForName(series.name)}
                            </text>
                          )}
                          <circle className="fill-transparent stroke-white/75 dark:stroke-black/70" cx={point.x} cy={point.y} r={endpointRadius - 1} strokeWidth="1" />
                        </g>
                      ) : (
                        <circle
                          className="fill-[#F5F1EB] dark:fill-[#0B0B0B]"
                          cx={point.x}
                          cy={point.y}
                          r={isActive ? 7 : 5.5}
                          stroke={color}
                          strokeWidth={isActive ? 4 : 3}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        {tooltip ? (() => {
          const tooltipAthlete = profileAthleteFromSeries(tooltip.series);
          const tooltipHref = publicProfileHref(tooltipAthlete);
          const tooltipImageSrc = resolveUsableAthletePhotoUrl(tooltip.series.profilePhotoUrl);
          const tooltipLeft = Math.max(8, Math.min(tooltip.x + 22, width - tooltipWidth - 8));
          const tooltipTop = Math.max(8, Math.min(tooltip.y - 98, height - 188));
          const tooltipMovement = rankMovementTooltip(tooltip.previousRank, tooltip.point.rank);
          const tooltipValue = tooltip.point.value === null ? "-" : formatMetricValue(tooltip.point.value, tooltip.series.metric);

          return (
            <div
              className="pointer-events-auto absolute z-10 w-[260px] rounded-2xl border border-secondary-sand/80 bg-white/95 p-3 text-sm shadow-2xl ring-1 ring-primary-charcoal/5 dark:border-zinc-700 dark:bg-[#151515]/95 dark:ring-white/10"
              data-chart-tooltip
              data-testid="leaderboard-chart-profile-tooltip"
              onMouseEnter={() => {
                setHoveredKey(tooltip.series.key);
                onHighlightChange?.(tooltip.series.key);
              }}
              onMouseLeave={() => {
                setHoveredKey(null);
                onHighlightChange?.(null);
                setTooltip(null);
              }}
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-green/15 text-xs font-black text-primary-green ring-2 ring-primary-green/20 dark:bg-secondary-teal/10 dark:text-secondary-teal dark:ring-secondary-teal/25">
                  {tooltipImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`${tooltip.series.name} profile`} className="h-full w-full object-cover" src={tooltipImageSrc} />
                  ) : (
                    initialsForName(tooltip.series.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-poppins text-sm font-black text-primary-charcoal dark:text-gray-100">{tooltip.series.name}</p>
                  <p className="mt-0.5 truncate text-[11px] font-black text-primary-charcoal/45 dark:text-gray-500">
                    @{tooltip.series.username ?? tooltip.series.normalizedName ?? "profil-belum-terhubung"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-1.5 rounded-xl bg-primary-beige/70 p-2.5 dark:bg-zinc-950/80">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">Rank</span>
                  <span className="font-poppins text-sm font-black text-primary-charcoal dark:text-white">#{tooltip.point.rank ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">Nilai</span>
                  <span className="min-w-0 text-right font-poppins text-sm font-black text-primary-charcoal dark:text-white">{tooltipValue}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">Gerak</span>
                  <span className="min-w-0 text-right font-poppins text-sm font-black leading-5 text-primary-charcoal dark:text-white">{tooltipMovement}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-2 border-t border-secondary-sand/70 pt-3 dark:border-zinc-700">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">
                  Periode: <span className="normal-case tracking-normal text-primary-charcoal/70 dark:text-gray-300">{tooltip.weekLabel}</span>
                </p>
                {tooltipHref ? (
                  <Link
                    className="inline-flex h-8 w-fit shrink-0 items-center justify-center rounded-lg bg-primary-brown px-3 text-xs font-black text-white transition hover:bg-primary-brown/90 focus:outline-none focus:ring-2 focus:ring-primary-brown/35"
                    href={tooltipHref}
                  >
                    Lihat profil
                  </Link>
                ) : (
                  <button
                    className="inline-flex h-8 w-fit shrink-0 items-center justify-center rounded-lg border border-secondary-sand bg-white px-3 text-xs font-black text-primary-charcoal transition hover:bg-secondary-sand/30 focus:outline-none focus:ring-2 focus:ring-primary-brown/25 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100"
                    onClick={() => onAthleteOpen(tooltipAthlete)}
                    type="button"
                  >
                    Detail
                  </button>
                )}
              </div>
            </div>
          );
        })() : null}
      </div>
      {leaderboard ? <div className="mt-5 border-t border-secondary-sand/60 pt-5 dark:border-zinc-800">{leaderboard}</div> : null}
    </div>
    <AthleteProfilePopover athlete={selectedProfileAthlete} onClose={() => setSelectedProfileAthlete(null)} />
    </>
  );
}

function compactPeriodLabel(snapshot: LeaderboardWeekSnapshot) {
  const dateRange = snapshot.spec.dateRange?.trim();

  if (!dateRange) {
    return displayWeekLabel(snapshot);
  }

  const match = dateRange.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);

  if (!match) {
    return dateRange;
  }

  const [, startDay, startMonthRaw, startYear, endDay, endMonthRaw, endYear] = match;
  const startMonth = startMonthRaw.slice(0, 3).toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
  const endMonth = endMonthRaw.slice(0, 3).toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}–${endDay} ${endMonth} ${endYear}`;
  }

  if (startYear === endYear) {
    return `${startDay} ${startMonth}–${endDay} ${endMonth} ${endYear}`;
  }

  return `${startDay} ${startMonth} ${startYear}–${endDay} ${endMonth} ${endYear}`;
}

export function WeekTabs({
  selectedKey,
  snapshots,
  onSelect,
}: {
  selectedKey: string;
  snapshots: LeaderboardWeekSnapshot[];
  onSelect: (key: string) => void;
}) {
  if (!snapshots.length) {
    return null;
  }

  const keyForSnapshot = (snapshot: LeaderboardWeekSnapshot) => `${snapshot.seasonYear}:${snapshot.weekNumber}:${snapshot.templateId}`;
  const selectedIndex = Math.max(0, snapshots.findIndex((snapshot) => keyForSnapshot(snapshot) === selectedKey));
  const selectedSnapshot = snapshots[selectedIndex] ?? snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots[selectedIndex - 1];
  const nextSnapshot = snapshots[selectedIndex + 1];

  return (
    <nav aria-label="Navigasi periode ranking" className="flex items-center gap-3 text-sm font-bold text-primary-charcoal/62 dark:text-gray-300">
      <button
        aria-label="Lihat periode sebelumnya"
        className="text-lg leading-none text-primary-brown/45 transition hover:-translate-x-0.5 hover:text-primary-brown disabled:pointer-events-none disabled:opacity-25 dark:text-secondary-sand/55 dark:hover:text-secondary-sand"
        disabled={!previousSnapshot}
        onClick={() => previousSnapshot && onSelect(keyForSnapshot(previousSnapshot))}
        type="button"
      >
        ‹
      </button>
      <select
        aria-label="Lompat ke periode tertentu"
        className="min-w-[128px] rounded-lg border border-transparent bg-transparent text-center tracking-[-0.01em] hover:border-secondary-sand/70 focus:outline-none focus:ring-2 focus:ring-primary-green/30 dark:hover:border-zinc-700"
        onChange={(event) => onSelect(event.target.value)}
        value={keyForSnapshot(selectedSnapshot)}
      >
        {snapshots
          .slice()
          .reverse()
          .map((snapshot) => (
            <option key={keyForSnapshot(snapshot)} value={keyForSnapshot(snapshot)}>
              {compactPeriodLabel(snapshot)}
            </option>
          ))}
      </select>
      <button
        aria-label="Lihat periode berikutnya"
        className="text-lg leading-none text-primary-brown/45 transition hover:translate-x-0.5 hover:text-primary-brown disabled:pointer-events-none disabled:opacity-25 dark:text-secondary-sand/55 dark:hover:text-secondary-sand"
        disabled={!nextSnapshot}
        onClick={() => nextSnapshot && onSelect(keyForSnapshot(nextSnapshot))}
        type="button"
      >
        ›
      </button>
    </nav>
  );
}

function exportLayoutModeForPreview(spec: LeaderboardSpec): ExportLayoutMode {
  if (spec.exportLayoutMode) {
    return spec.exportLayoutMode;
  }

  if (spec.athletes.length > 5) {
    return "podiumTop10";
  }

  return `top${Math.max(1, Math.min(5, spec.athletes.length))}` as ExportLayoutMode;
}

function visibleExportPhotoAthletes(spec: LeaderboardSpec) {
  const layoutMode = exportLayoutModeForPreview(spec);
  const ranked = buildLeaderboardRows(spec.athletes, layoutMode === "podiumTop10" ? 3 : 5);

  return layoutMode === "podiumTop10" ? ranked.slice(0, 3) : ranked;
}

function exportPhotoAdjustmentValue(
  adjustments: ExportPhotoAdjustments,
  layoutMode: ExportLayoutMode,
  athlete?: RankedAthlete,
): ExportPhotoAdjustment {
  if (!athlete) {
    return defaultExportPhotoAdjustment;
  }

  return resolveAthletePhotoAdjustment({
    athlete,
    exportPhotoAdjustments: adjustments,
    layoutMode,
  });
}

interface ExportPhotoEditorDragState {
  athleteId: string;
  height: number;
  layoutMode: ExportLayoutMode;
  pointerId: number;
  startAdjustment: ExportPhotoAdjustment;
  startX: number;
  startY: number;
  width: number;
}

function exportPhotoAdjustTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-export-photo-adjust-target="true"]') : null;
}

function clampPhotoAdjustmentCoordinate(value: number) {
  return Math.min(EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMax, Math.max(EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMin, value));
}

function clampPhotoAdjustmentZoom(value: number) {
  return Math.min(EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMax, Math.max(EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMin, value));
}

function cssAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function ExportPreviewModal({
  exportAthleteSelection,
  exportAthleteSelectionOptions,
  exportPhotoAdjustments,
  exporting,
  refreshingExportPreview,
  onClose,
  onDownload,
  onExportAthleteSelectionChange,
  onExportPhotoAdjustmentChange,
  onExportPhotoAdjustmentReset,
  onRefresh,
  open,
  spec,
}: {
  exportAthleteSelection: ExportAthleteSelection;
  exportAthleteSelectionOptions: ExportAthleteSelectionOption[];
  exportPhotoAdjustments: ExportPhotoAdjustments;
  exporting: boolean;
  refreshingExportPreview: boolean;
  onClose: () => void;
  onDownload: () => void;
  onExportAthleteSelectionChange: (selection: ExportAthleteSelection) => void;
  onExportPhotoAdjustmentChange: (layoutMode: ExportLayoutMode, athleteId: string, adjustment: ExportPhotoAdjustment) => void;
  onExportPhotoAdjustmentReset: (layoutMode: ExportLayoutMode, athleteId: string) => void;
  onRefresh: () => void;
  open: boolean;
  spec: LeaderboardSpec;
}) {
  const dialogRef = useModalA11y<HTMLElement>(open, onClose);
  const previewScale = 0.28;
  const layoutMode = exportLayoutModeForPreview(spec);
  const adjustableAthletes = useMemo(() => visibleExportPhotoAthletes(spec), [spec]);
  const [selectedAdjustAthleteId, setSelectedAdjustAthleteId] = useState(adjustableAthletes[0]?.id ?? "");
  const resolvedSelectedAdjustAthleteId = adjustableAthletes.some((athlete) => athlete.id === selectedAdjustAthleteId)
    ? selectedAdjustAthleteId
    : adjustableAthletes[0]?.id ?? "";
  const selectedAdjustAthlete = adjustableAthletes.find((athlete) => athlete.id === resolvedSelectedAdjustAthleteId);
  const selectedAdjustment = exportPhotoAdjustmentValue(exportPhotoAdjustments, layoutMode, selectedAdjustAthlete);
  const displayZoom = clampPhotoAdjustmentZoom(selectedAdjustment.zoom);
  const controlsDisabled = exporting || refreshingExportPreview;
  const dragStateRef = useRef<ExportPhotoEditorDragState | null>(null);
  const [draggingPhotoAthleteId, setDraggingPhotoAthleteId] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const activeAthleteSelector = selectedAdjustAthlete ? cssAttributeValue(selectedAdjustAthlete.id) : "";
  const previewEditorStyles = `
    [data-export-preview-stage] [data-export-photo-adjust-target="true"] {
      cursor: grab;
    }
    [data-export-preview-stage] [data-export-photo-adjust-target="true"]:hover {
      outline: 8px solid rgba(255, 199, 44, 0.22);
      outline-offset: -8px;
    }
    ${
      activeAthleteSelector
        ? `[data-export-preview-stage] [data-export-photo-adjust-target="true"][data-athlete-id="${activeAthleteSelector}"] {
      outline: 10px solid rgba(255, 199, 44, 0.38);
      outline-offset: -10px;
      box-shadow: inset 0 0 0 4px rgba(0, 0, 0, 0.42);
    }`
        : ""
    }
    [data-export-preview-stage][data-export-preview-dragging="true"] [data-export-photo-adjust-target="true"] {
      cursor: grabbing;
    }
  `;

  function updateSelectedAdjustment(patch: Partial<ExportPhotoAdjustment>) {
    if (!selectedAdjustAthlete) {
      return;
    }

    onExportPhotoAdjustmentChange(layoutMode, selectedAdjustAthlete.id, {
      ...selectedAdjustment,
      ...patch,
    });
  }

  function handleBackupPositions() {
    const blob = new Blob([JSON.stringify(exportPhotoAdjustments, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `leaderboard-positions-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestorePositions(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const restored = JSON.parse(await file.text()) as Record<string, Record<string, Partial<ExportPhotoAdjustment>>>;
      for (const mode of STORY_EXPORT_LAYOUT_MODES) {
        const athleteAdjustments = restored[mode];
        if (!athleteAdjustments) {
          continue;
        }
        for (const [athleteId, adjustment] of Object.entries(athleteAdjustments)) {
          onExportPhotoAdjustmentChange(mode, athleteId, clampExportPhotoAdjustment(adjustment));
        }
      }
      setRestoreError("");
    } catch {
      setRestoreError("File konfigurasi tidak valid.");
    }
  }

  function adjustmentForEditableAthlete(athleteId: string, targetLayoutMode: ExportLayoutMode) {
    const athlete = adjustableAthletes.find((candidate) => candidate.id === athleteId);
    return athlete ? exportPhotoAdjustmentValue(exportPhotoAdjustments, targetLayoutMode, athlete) : undefined;
  }

  function handleExportPreviewPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (controlsDisabled || event.button !== 0) {
      return;
    }

    const target = exportPhotoAdjustTarget(event.target);
    const athleteId = target?.dataset.athleteId;
    const targetLayoutMode = target?.dataset.layoutMode as ExportLayoutMode | undefined;
    if (!target || !athleteId || targetLayoutMode !== layoutMode) {
      return;
    }

    const startAdjustment = adjustmentForEditableAthlete(athleteId, targetLayoutMode);
    if (!startAdjustment) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    setSelectedAdjustAthleteId(athleteId);
    setDraggingPhotoAthleteId(athleteId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    dragStateRef.current = {
      athleteId,
      height: Math.max(1, targetRect.height / previewScale),
      layoutMode: targetLayoutMode,
      pointerId: event.pointerId,
      startAdjustment,
      startX: event.clientX,
      startY: event.clientY,
      width: Math.max(1, targetRect.width / previewScale),
    };
  }

  function handleExportPreviewPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || controlsDisabled) {
      return;
    }

    event.preventDefault();
    onExportPhotoAdjustmentChange(
      dragState.layoutMode,
      dragState.athleteId,
      exportPhotoAdjustmentFromDrag({
        currentX: event.clientX,
        currentY: event.clientY,
        layoutMode: dragState.layoutMode,
        previewScale,
        startAdjustment: dragState.startAdjustment,
        startX: dragState.startX,
        startY: dragState.startY,
        targetHeight: dragState.height,
        targetWidth: dragState.width,
      }),
    );
  }

  function handleExportPreviewPointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(dragState.pointerId)) {
      event.currentTarget.releasePointerCapture(dragState.pointerId);
    }
    dragStateRef.current = null;
    setDraggingPhotoAthleteId("");
  }

  function handleExportPreviewWheel(event: WheelEvent<HTMLDivElement>) {
    if (controlsDisabled) {
      return;
    }

    const target = exportPhotoAdjustTarget(event.target);
    const athleteId = target?.dataset.athleteId;
    const targetLayoutMode = target?.dataset.layoutMode as ExportLayoutMode | undefined;
    if (!athleteId || targetLayoutMode !== layoutMode) {
      return;
    }

    const currentAdjustment = adjustmentForEditableAthlete(athleteId, targetLayoutMode);
    if (!currentAdjustment) {
      return;
    }

    const zoomDelta = event.deltaY > 0 ? -0.05 : 0.05;

    setSelectedAdjustAthleteId(athleteId);
    event.preventDefault();
    onExportPhotoAdjustmentChange(targetLayoutMode, athleteId, {
      ...currentAdjustment,
      zoom: clampPhotoAdjustmentZoom(currentAdjustment.zoom + zoomDelta),
    });
  }

  function nudgeSelectedZoom(delta: number) {
    updateSelectedAdjustment({
      zoom: clampPhotoAdjustmentZoom(displayZoom + delta),
    });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-primary-charcoal/70 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label="Pratinjau gambar leaderboard"
        aria-modal="true"
        className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl border border-secondary-sand/50 bg-primary-beige p-5 shadow-2xl dark:border-zinc-700 dark:bg-[#121212]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-poppins text-2xl font-bold text-primary-charcoal dark:text-gray-100">Pratinjau gambar</h2>
            <p className="mt-1 text-sm text-primary-charcoal/60 dark:text-gray-400">Cek poster sebelum diunduh sebagai PNG.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Cadangkan posisi foto"
              className="grid size-10 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
              onClick={handleBackupPositions}
              title="Cadangkan posisi foto (JSON)"
              type="button"
            >
              <Download className="size-5" />
            </button>
            <label
              aria-label="Pulihkan posisi foto"
              className="grid size-10 cursor-pointer place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
              title="Pulihkan posisi foto dari JSON"
            >
              <Upload className="size-5" />
              <input accept="application/json" className="sr-only" onChange={(event) => void handleRestorePositions(event)} type="file" />
            </label>
            <button
              aria-label="Muat ulang pratinjau"
              className="grid size-10 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
              disabled={controlsDisabled}
              onClick={onRefresh}
              title="Muat ulang pratinjau"
              type="button"
            >
              <RefreshCw className={cn("size-5", refreshingExportPreview && "animate-spin")} />
            </button>
            <button
              aria-label="Tutup pratinjau gambar"
              className="grid size-10 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
              onClick={onClose}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        {restoreError ? <p className="mb-3 text-sm font-bold text-red-600 dark:text-red-300">{restoreError}</p> : null}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div
            className="grid place-items-center overflow-auto rounded-xl bg-primary-charcoal p-4"
            data-export-preview-active-athlete={selectedAdjustAthlete?.id}
            data-export-preview-dragging={draggingPhotoAthleteId ? "true" : "false"}
            data-export-preview-stage
            data-testid="export-preview-stage"
            onPointerCancel={handleExportPreviewPointerUp}
            onPointerDown={handleExportPreviewPointerDown}
            onPointerMove={handleExportPreviewPointerMove}
            onPointerUp={handleExportPreviewPointerUp}
            onWheel={handleExportPreviewWheel}
          >
            <style>{previewEditorStyles}</style>
            <div
              style={
                {
                  height: `${OUTPUT_DIMENSIONS[STORY_FORMAT].height * previewScale}px`,
                  width: `${OUTPUT_DIMENSIONS[STORY_FORMAT].width * previewScale}px`,
                } as CSSProperties
              }
            >
              <div
                style={{
                  height: OUTPUT_DIMENSIONS[STORY_FORMAT].height,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                  width: OUTPUT_DIMENSIONS[STORY_FORMAT].width,
                }}
              >
                <LeaderboardCanvas format={STORY_FORMAT as OutputFormat} spec={spec} />
              </div>
            </div>
          </div>
          <div className="grid content-start gap-3">
            {exportAthleteSelectionOptions.length > 1 ? (
              <div
                className="rounded-xl border border-secondary-sand/70 bg-white/70 p-3 shadow-[0_8px_22px_rgb(90,46,23,0.08)] dark:border-zinc-700 dark:bg-zinc-900/80"
                data-testid="export-athlete-picker"
              >
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-primary-charcoal/55 dark:text-gray-400">
                  <Users className="size-3.5" />
                  Anggota
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {exportAthleteSelectionOptions.map((option) => {
                    const active = option.value === exportAthleteSelection;

                    return (
                      <button
                        aria-pressed={active}
                        className={cn(
                          "h-10 rounded-xl border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                          active
                            ? "border-primary-brown bg-primary-brown text-white shadow-[0_10px_22px_rgb(90,46,23,0.18)]"
                            : "border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100",
                        )}
                          disabled={controlsDisabled}
                          key={option.value}
                          onClick={() => onExportAthleteSelectionChange(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div
              className="rounded-xl border border-secondary-sand/70 bg-white/70 p-3 shadow-[0_8px_22px_rgb(90,46,23,0.08)] dark:border-zinc-700 dark:bg-zinc-900/80"
              data-testid="export-photo-adjust-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-black uppercase tracking-[0.12em] text-primary-charcoal/55 dark:text-gray-400">
                  Atur Foto
                </div>
                <span className="rounded-full bg-primary-brown/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-primary-brown dark:bg-secondary-sand/10 dark:text-secondary-sand">
                  {layoutMode === "podiumTop10" ? "Podium" : layoutMode.replace("top", "Top ")}
                </span>
              </div>
              {adjustableAthletes.length ? (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-1.5" data-testid="export-photo-adjust-athletes">
                    {adjustableAthletes.map((athlete) => {
                      const active = athlete.id === selectedAdjustAthlete?.id;

                      return (
                        <button
                          aria-pressed={active}
                          className={cn(
                            "h-9 min-w-0 rounded-lg border px-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                            active
                              ? "border-primary-brown bg-primary-brown text-white"
                              : "border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100",
                          )}
                          disabled={controlsDisabled}
                          key={athlete.id}
                          onClick={() => setSelectedAdjustAthleteId(athlete.id)}
                          title={athlete.name}
                          type="button"
                        >
                          #{athlete.rank}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 truncate text-sm font-black text-primary-charcoal dark:text-gray-100" title={selectedAdjustAthlete?.name}>
                    {selectedAdjustAthlete?.name}
                  </div>
                  <div
                    className="mt-3 grid gap-2 rounded-xl border border-secondary-sand/70 bg-white/70 p-2.5 dark:border-zinc-700 dark:bg-zinc-950/70"
                    data-testid="export-photo-direct-editor"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 font-mono text-xs font-black text-primary-charcoal/60 dark:text-gray-400">
                        <input
                          aria-label="Nilai zoom"
                          className="w-14 rounded-lg border border-secondary-sand bg-white px-1.5 py-1 text-right font-mono text-xs font-black text-primary-charcoal disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                          disabled={controlsDisabled || !selectedAdjustAthlete}
                          max={EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMax}
                          min={EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMin}
                          onChange={(event) => updateSelectedAdjustment({ zoom: clampPhotoAdjustmentZoom(Number(event.currentTarget.value)) })}
                          step="0.05"
                          type="number"
                          value={displayZoom.toFixed(2)}
                        />
                        x
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          aria-label="Perkecil foto terpilih"
                          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                          disabled={controlsDisabled || !selectedAdjustAthlete}
                          onClick={() => nudgeSelectedZoom(-0.05)}
                          type="button"
                        >
                          <Minus className="size-4" />
                        </button>
                        <button
                          aria-label="Perbesar foto terpilih"
                          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-secondary-sand bg-white text-primary-charcoal transition hover:bg-secondary-sand/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                          disabled={controlsDisabled || !selectedAdjustAthlete}
                          onClick={() => nudgeSelectedZoom(0.05)}
                          type="button"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] font-black text-primary-charcoal/45 dark:text-gray-500">
                      <label className="flex items-center gap-1 rounded-lg bg-primary-beige/80 px-2 py-1 dark:bg-zinc-900">
                        X
                        <input
                          aria-label="Posisi horizontal"
                          className="w-full min-w-0 bg-transparent text-right font-mono text-[11px] font-black text-primary-charcoal disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100"
                          disabled={controlsDisabled || !selectedAdjustAthlete}
                          max={EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMax}
                          min={EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMin}
                          onChange={(event) => updateSelectedAdjustment({ x: clampPhotoAdjustmentCoordinate(Number(event.currentTarget.value)) })}
                          step="1"
                          type="number"
                          value={Math.round(selectedAdjustment.x)}
                        />
                      </label>
                      <label className="flex items-center gap-1 rounded-lg bg-primary-beige/80 px-2 py-1 dark:bg-zinc-900">
                        Y
                        <input
                          aria-label="Posisi vertikal"
                          className="w-full min-w-0 bg-transparent text-right font-mono text-[11px] font-black text-primary-charcoal disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100"
                          disabled={controlsDisabled || !selectedAdjustAthlete}
                          max={EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMax}
                          min={EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMin}
                          onChange={(event) => updateSelectedAdjustment({ y: clampPhotoAdjustmentCoordinate(Number(event.currentTarget.value)) })}
                          step="1"
                          type="number"
                          value={Math.round(selectedAdjustment.y)}
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    className={buttonClassName("mt-3 h-9 w-full border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100")}
                    disabled={controlsDisabled || !selectedAdjustAthlete}
                    onClick={() => selectedAdjustAthlete && onExportPhotoAdjustmentReset(layoutMode, selectedAdjustAthlete.id)}
                    type="button"
                  >
                    Atur ulang
                  </button>
                </>
              ) : (
                <p className="mt-3 text-xs font-semibold leading-5 text-primary-charcoal/55 dark:text-gray-400">Tidak ada foto anggota untuk tampilan ini.</p>
              )}
            </div>
            <button
              className={buttonClassName("bg-primary-brown text-white shadow-[0_12px_30px_rgb(90,46,23,0.18)] hover:bg-primary-brown/90")}
              disabled={exporting || refreshingExportPreview}
              onClick={onDownload}
              type="button"
            >
              {exporting ? "Menyiapkan..." : "Unduh PNG"}
            </button>
            <button
              className={buttonClassName("border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
              onClick={onClose}
              type="button"
            >
              Batal
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function chartDataFromSnapshots(snapshots: LeaderboardWeekSnapshot[], maxWeeks = 4) {
  return buildBumpChartData(snapshots, { maxWeeks });
}
