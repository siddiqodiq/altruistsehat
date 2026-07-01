"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bike,
  CalendarDays,
  Download,
  Dumbbell,
  Footprints,
  RefreshCw,
  Save,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { LeaderboardCanvas } from "./LeaderboardCanvas";
import { initialsForName } from "@/lib/leaderboard/images";
import { buildBumpChartData, leaderboardAthleteKey, type BumpChartData } from "@/lib/leaderboard/bump-chart";
import { LEADERBOARD_CATEGORIES, type LeaderboardCategoryId } from "@/lib/leaderboard/categories";
import { formatMetricValue } from "@/lib/leaderboard/metrics";
import { isCompactExportLayoutMode, resolveAthletePhotoAdjustment } from "@/lib/leaderboard/photo-adjustments";
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
} from "@/lib/leaderboard/types";
import { displayWeekLabel, STORY_FORMAT } from "@/lib/leaderboard/dashboard-state";
import { defaultExportPhotoAdjustment, type ExportAthleteSelection, type ExportAthleteSelectionOption } from "@/lib/leaderboard/export-client";
import type { LeaderboardWeekSnapshot } from "@/lib/leaderboard/week-snapshots";
import { cn } from "@/lib/utils";

export function buttonClassName(className?: string) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
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

const categoryIcons: Record<LeaderboardCategoryId, LucideIcon> = {
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  weight_training: Dumbbell,
};

export interface CategorySummary {
  athleteCount: number;
  metric: MetricType;
  total: number;
}

export function CategorySwitch({
  selectedCategory,
  summaries = {},
  onSelect,
}: {
  selectedCategory: LeaderboardCategoryId;
  summaries?: Partial<Record<LeaderboardCategoryId, CategorySummary>>;
  onSelect: (category: LeaderboardCategoryId) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = LEADERBOARD_CATEGORIES.findIndex((category) => category.id === selectedCategory);
    if (currentIndex < 0) {
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) {
      return;
    }

    event.preventDefault();
    const nextIndex = (currentIndex + direction + LEADERBOARD_CATEGORIES.length) % LEADERBOARD_CATEGORIES.length;
    onSelect(LEADERBOARD_CATEGORIES[nextIndex].id);
  }

  return (
    <section aria-label="Pilih kompetisi olahraga" className="relative z-20 -mt-9 md:-mt-10">
      <div
        className="flex min-h-[82px] overflow-x-auto rounded-[1.5rem] border border-secondary-sand/70 bg-white/94 p-2 shadow-[0_18px_48px_rgb(90,46,23,0.12)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/94"
        onKeyDown={handleKeyDown}
        role="tablist"
      >
        {LEADERBOARD_CATEGORIES.map((category) => {
          const Icon = categoryIcons[category.id];
          const isActive = selectedCategory === category.id;
          const summary = summaries[category.id];
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
              key={category.id}
              onClick={() => onSelect(category.id)}
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
                  {category.label}
                </span>
                <span className={cn("mt-1 block text-sm font-bold", isActive ? "text-white/82" : "text-primary-charcoal/55 dark:text-gray-400")}>
                  {total} <span className="px-1 opacity-50">·</span> {athletes} atlet
                </span>
                {isActive ? <span className="mt-3 block h-0.5 w-20 rounded-full bg-secondary-sand" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function movementBadge(movement?: AthleteMovement) {
  if (!movement || !movement.fromRank) {
    return <span className="text-primary-charcoal/40 dark:text-gray-500">-</span>;
  }

  if (movement.delta > 0) {
    return <span className="text-primary-green dark:text-secondary-teal">+{movement.delta}</span>;
  }

  if (movement.delta < 0) {
    return <span className="text-secondary-clay dark:text-secondary-sand">-{Math.abs(movement.delta)}</span>;
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

function trendLabel(name: string) {
  return name.length > 16 ? `${name.slice(0, 14)}...` : name;
}

function rankChangeLabel(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }

  if (delta < 0) {
    return `-${Math.abs(delta)}`;
  }

  return "-";
}


function percentageLabel(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "baru";
  }

  if (Math.abs(value) < 1) {
    return "stabil";
  }

  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
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

function Sparkline({ values }: { values: number[] }) {
  const width = 112;
  const height = 32;
  const padding = 4;

  if (values.length < 2) {
    return <span className="text-xs font-bold text-primary-charcoal/35 dark:text-gray-500">Belum cukup data</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const path = values
    .map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg aria-hidden="true" className="h-8 w-28" viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke="#5A2E17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      <circle cx={width - padding} cy={height - padding - ((values[values.length - 1] - min) / range) * (height - padding * 2)} fill="#5E7A5E" r="3" />
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
              Refresh
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
              Export
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
  const [showAll, setShowAll] = useState(false);
  const rankedAthletes = buildLeaderboardRows(spec.athletes, Math.max(10, spec.athletes.length));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAthletes = normalizedQuery
    ? rankedAthletes.filter((athlete) => athlete.name.toLowerCase().includes(normalizedQuery))
    : rankedAthletes;
  const athletes = normalizedQuery || showAll ? filteredAthletes : filteredAthletes.slice(0, 10);
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

  const tableBody = !rankedAthletes.length ? (
    <div className="p-5">
      <EmptyState title="Belum ada ranking" message="Data ranking akan muncul setelah snapshot minggu tersedia." />
    </div>
  ) : !athletes.length ? (
    <div className="p-5">
      <EmptyState title="Atlet tidak ditemukan" message="Coba kata kunci lain untuk mencari atlet di klasemen ini." />
    </div>
  ) : (
    <div className="overflow-hidden rounded-[1.35rem] border border-secondary-sand/60 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="max-h-[560px] w-full overflow-auto">
        <table className="w-full min-w-[1040px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[80px]" />
            <col className="w-[320px]" />
            <col className="w-[160px]" />
            <col className="w-[130px]" />
            <col className="w-[170px]" />
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-secondary-sand/50 bg-white text-xs font-black uppercase tracking-[0.08em] text-primary-charcoal/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-500">
              <th className="sticky left-0 z-30 whitespace-nowrap bg-inherit px-5 py-4 text-left">Rank</th>
              <th className="sticky left-[80px] z-30 whitespace-nowrap bg-inherit px-5 py-4 text-left">Atlet</th>
              <th className="whitespace-nowrap px-5 py-4 text-right">{spec.metric === "time_minutes" ? "Waktu" : "Mileage"}</th>
              <th className="whitespace-nowrap px-5 py-4 text-center">Perubahan</th>
              <th className="whitespace-nowrap px-5 py-4 text-left">Trend</th>
              <th className="whitespace-nowrap px-5 py-4 text-left">Aktivitas</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => {
              const key = leaderboardAthleteKey(athlete);
              const isHighlighted = highlightedKey === key;
              const movement = movementByAthleteKey[key];
              const values = trendByAthlete.get(key) ?? [];

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
                  <td className="sticky left-0 z-20 whitespace-nowrap bg-inherit px-5 py-4 font-poppins text-xl font-black text-primary-brown dark:text-secondary-sand">#{athlete.rank}</td>
                  <td className="sticky left-[80px] z-20 bg-inherit px-5 py-4">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary-sand/70 text-[11px] font-black text-primary-brown ring-1 ring-primary-brown/10 dark:bg-zinc-800 dark:text-secondary-sand">
                        {athlete.profilePhotoUrl || athlete.avatarDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`${athlete.name} avatar`}
                            className="h-full w-full object-cover"
                            src={athlete.profilePhotoUrl ?? athlete.avatarDataUrl}
                          />
                        ) : (
                          initialsForName(athlete.name)
                        )}
                      </span>
                      <span className="min-w-0 truncate font-bold text-primary-charcoal dark:text-gray-100">{athlete.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-black text-primary-charcoal dark:text-gray-100">
                    {formatMetricValue(athlete.value, spec.metric)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-center text-sm font-black">{movementBadge(movement)}</td>
                  <td className="px-5 py-4"><Sparkline values={values} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-primary-charcoal/48 dark:text-gray-500">Minggu ini</td>
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
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setShowAll(false);
              }}
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
              Refresh
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
              Export
            </button>
          ) : null}
        </div>
      </div>
      {tableBody}
      {!normalizedQuery && !showAll && rankedAthletes.length > 10 ? (
        <button
          className="text-sm font-black text-primary-brown underline-offset-4 hover:underline dark:text-secondary-sand"
          onClick={() => setShowAll(true)}
          type="button"
        >
          Lihat Semua Atlet →
        </button>
      ) : null}
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
  const delta = percentageLabel(story.totalDeltaPercent);
  const average = activeAthletes ? total / activeAthletes : 0;
  const storyLines = [
    story.topMover ? `${story.topMover.name} naik ${story.topMover.delta} posisi.` : "Pergerakan naik mulai terbentuk.",
    story.biggestDrop ? `${story.biggestDrop.name} turun ${Math.abs(story.biggestDrop.delta)} posisi.` : "Pack relatif stabil minggu ini.",
    leader && story.leaderStreak && story.leaderStreak > 1
      ? `${leader.name} memimpin ${story.leaderStreak} minggu beruntun.`
      : "Perebutan podium masih terbuka.",
    `Komunitas semakin aktif dengan ${activeAthletes} atlet.`,
  ];

  return (
    <section className="relative overflow-hidden border-b border-secondary-sand/60 bg-[#f7f3ee] pt-24 dark:border-zinc-800 dark:bg-[#121212] md:pt-28">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 pb-14 sm:px-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(430px,1.02fr)] lg:items-stretch lg:px-8">
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
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">Atlet aktif</p>
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

export function MovementNarrative({ data, metric, story }: { data?: BumpChartData; metric: LeaderboardSpec["metric"]; story: LeaderboardStory }) {
  const leader = story.leader;
  const insightLines = [
    leader
      ? `${leader.name} mempertahankan lead dengan ${formatMetricValue(leader.value, metric)}${story.leaderStreak && story.leaderStreak > 1 ? `, sudah ${story.leaderStreak} minggu di puncak.` : "."}`
      : "Belum ada pemimpin minggu ini.",
    story.topMover
      ? `${story.topMover.name} menjadi cerita kenaikan terbesar, melompat ${story.topMover.delta} posisi.`
      : "Belum ada lonjakan ranking besar dari minggu sebelumnya.",
    story.biggestDrop
      ? `${story.biggestDrop.name} kehilangan ${Math.abs(story.biggestDrop.delta)} posisi dan masuk zona tekanan.`
      : "Tidak ada penurunan besar; pack relatif stabil.",
    story.athleteCount
      ? `${story.athleteCount} atlet aktif tercatat dalam kompetisi minggu ini.`
      : "Aktivitas komunitas akan muncul setelah snapshot tersedia.",
  ];
  const movers = data?.topMovers?.length
    ? data.topMovers
    : story.topMover
      ? [{ key: story.topMover.key, name: story.topMover.name, delta: story.topMover.delta, fromRank: story.topMover.fromRank ?? story.topMover.toRank, toRank: story.topMover.toRank }]
      : [];
  const drops = data?.biggestDrops?.length
    ? data.biggestDrops
    : story.biggestDrop
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
          href="/"
        >
          Lihat Kegiatan
        </Link>
      </section>
    </aside>
  );
}

export function BumpChart({
  actionSlot,
  data,
  highlightedKey,
  leaderboard,
  onHighlightChange,
  toolbar,
}: {
  actionSlot?: ReactNode;
  data: BumpChartData;
  highlightedKey?: string | null;
  leaderboard?: ReactNode;
  onHighlightChange?: (key: string | null) => void;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; scrollLeft: number } | null>(null);

  const width = Math.max(1120, data.weeks.length * 190);
  const padding = { top: 34, right: 180, bottom: 66, left: 78 };
  const colors = ["#5A2E17", "#5E7A5E", "#C49A7C", "#7EC8C1", "#B7D6E6", "#8C5A3B", "#2F6F73", "#92754B", "#3E4F3E", "#1F1F1F"];
  const activeKey = hoveredKey ?? selectedKey ?? highlightedKey ?? null;
  const selectedSeries = activeKey ? data.series.find((series) => series.key === activeKey) : undefined;
  const visibleSeries = useMemo(() => {
    if (selectedSeries && !data.series.some((series) => series.key === selectedSeries.key)) {
      return [...data.series, selectedSeries].sort((left, right) => left.latestRank - right.latestRank);
    }

    return data.series;
  }, [data.series, selectedSeries]);

  const maxDisplayedRank = Math.max(10, data.maxRank);
  const height = Math.max(520, Math.min(760, maxDisplayedRank * 48));
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
                {data.weeks.length} Minggu Terakhir · {historyRangeLabel || "Belum ada histori"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {actionSlot}
            </div>
          </div>
          {toolbar ? <div className="rounded-2xl border border-secondary-sand/60 bg-primary-beige/45 p-4 dark:border-zinc-800 dark:bg-zinc-950/35">{toolbar}</div> : null}
        </div>
        <div className="mt-4">
          <EmptyState title="Ranking story belum tersedia" message="Data beberapa minggu akan membentuk pergerakan ranking atlet di sini." />
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

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
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
      return "Tidak masuk Top 10";
    }

    if (!previousRank) {
      return "Baru masuk Top 10";
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
    <div className="min-w-0 rounded-[1.75rem] border border-secondary-sand/60 bg-white p-4 shadow-[0_18px_48px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 border-b border-secondary-sand/60 pb-4 dark:border-zinc-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-poppins text-3xl font-black tracking-[-0.04em] text-primary-charcoal dark:text-gray-100 md:text-4xl">
              Perebutan Puncak
            </h2>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">
              {data.weeks.length} Minggu Terakhir · {historyRangeLabel}
            </p>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-primary-charcoal/58 dark:text-gray-400">
              Bulan menjadi landmark utama, sementara detail tanggal muncul saat hover pada titik ranking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {actionSlot}
          </div>
        </div>
        {toolbar ? <div className="rounded-2xl border border-secondary-sand/60 bg-primary-beige/45 p-4 dark:border-zinc-800 dark:bg-zinc-950/35">{toolbar}</div> : null}
      </div>

      <div
        className="relative mt-4 max-h-[820px] w-full cursor-grab overflow-auto rounded-2xl bg-primary-beige/45 p-3 active:cursor-grabbing dark:bg-zinc-950/40"
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
        <svg aria-label="Bump chart ranking atlet" className="block" role="img" style={{ minWidth: width, width: "100%" }} viewBox={`0 0 ${width} ${height}`}>
          {zoneRect(1, 1, "fill-[#F2C94C]/12")}
          {zoneRect(2, 3, "fill-[#B7D6E6]/14")}
          {zoneRect(4, 5, "fill-[#C49A7C]/12")}
          {axisRanks.map((rank) => {
            const y = yForRank(rank);
            return (
              <g key={rank}>
                <line stroke="#E6D7C2" strokeDasharray={rank === 1 ? "0" : "4 7"} strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                <text fill="#5A2E17" fontSize="12" fontWeight="800" textAnchor="end" x={padding.left - 14} y={y + 4}>
                  #{rank}
                </text>
              </g>
            );
          })}
          {data.weeks.map((week, index) => {
            const x = xForWeek(index);
            return (
              <g key={week.key}>
                <line stroke="#E6D7C2" strokeWidth="1" x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} />
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
                <line stroke="#CDBCA9" strokeLinecap="round" strokeWidth="2" x1={lineStart} x2={lineEnd} y1={height - 34} y2={height - 34} />
                <text fill="#5A2E17" fontSize="13" fontWeight="900" textAnchor="middle" x={centerX} y={height - 14}>
                  {group.label}
                </text>
              </g>
            );
          })}
          {visibleSeries.map((series, seriesIndex) => {
            const points = pointsForSeries(series);
            const segments = rankedSegments(points);
            const rankedPoints = segments.flat();
            const color = colors[seriesIndex % colors.length];
            const isActive = activeKey === series.key;
            const hasSpotlight = Boolean(activeKey);
            const isInLatestTopTen = series.latestRank <= data.maxRank;
            const opacity = isActive ? 1 : hasSpotlight ? 0.12 : isInLatestTopTen && series.latestRank <= 5 ? 0.94 : isInLatestTopTen ? 0.46 : 0.24;
            const strokeWidth = isActive ? 5 : hasSpotlight ? 1.25 : isInLatestTopTen ? 3 : 2;
            const latestPoint = rankedPoints[rankedPoints.length - 1];
            const shouldShowLabel = Boolean(latestPoint && (series.latestRank <= 3 || selectedKey === series.key || hoveredKey === series.key || highlightedKey === series.key));

            return (
              <g key={series.key} opacity={opacity} style={{ transition: "opacity 200ms ease" }}>
                {segments.map((segment, segmentIndex) => (
                  <motion.path
                    animate={{ pathLength: 1 }}
                    d={curvedPath(segment)}
                    fill="none"
                    initial={{ pathLength: 0.82 }}
                    key={`${series.key}:segment:${segmentIndex}`}
                    onMouseEnter={() => {
                      setHoveredKey(series.key);
                      onHighlightChange?.(series.key);
                    }}
                    onMouseLeave={() => {
                      setHoveredKey(null);
                      onHighlightChange?.(null);
                      setTooltip(null);
                    }}
                    stroke={color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={strokeWidth}
                    style={{ transition: "stroke-width 200ms ease, opacity 200ms ease" }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                ))}
                {rankedPoints.map((point) => (
                  <g key={`${series.key}:${point.weekKey}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill="#F5F1EB"
                      onClick={() => {
                        setSelectedKey(series.key);
                        onHighlightChange?.(series.key);
                      }}
                      onMouseEnter={() => {
                        setHoveredKey(series.key);
                        onHighlightChange?.(series.key);
                        showTooltip(series, point);
                      }}
                      onMouseLeave={() => {
                        setHoveredKey(null);
                        onHighlightChange?.(null);
                        setTooltip(null);
                      }}
                      r={isActive ? 7 : 5.5}
                      stroke={color}
                      strokeWidth={isActive ? 4 : 3}
                    />
                  </g>
                ))}
                {shouldShowLabel && latestPoint ? (
                  <g transform={`translate(${latestPoint.x + 12} ${latestPoint.y - 15})`}>
                    <circle cx="14" cy="14" fill="#F7F3EE" r="14" stroke={color} strokeWidth="2" />
                    <text fill={color} fontSize="9" fontWeight="900" textAnchor="middle" x="14" y="17">
                      {initialsForName(series.name)}
                    </text>
                    <text fill={color} fontSize="13" fontWeight="900" x="34" y="18">
                      {trendLabel(series.name)} {rankChangeLabel(series.rankDelta)}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-2xl border border-secondary-sand bg-white/95 p-3 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900/95"
            style={{ left: Math.min(tooltip.x + 28, width - 250), top: Math.max(8, tooltip.y - 86) }}
          >
            <p className="font-poppins text-base font-black text-primary-charcoal dark:text-gray-100">{tooltip.series.name}</p>
            <div className="mt-3 grid gap-1.5 font-semibold text-primary-charcoal/70 dark:text-gray-300">
              <span>Peringkat #{tooltip.point.rank ?? "-"}</span>
              <span>{tooltip.point.value === null ? "-" : formatMetricValue(tooltip.point.value, tooltip.series.metric)}</span>
              <span>{rankMovementTooltip(tooltip.previousRank, tooltip.point.rank)}</span>
            </div>
            <div className="mt-3 border-t border-secondary-sand/70 pt-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-charcoal/45 dark:border-zinc-700 dark:text-gray-500">
              Periode: <span className="normal-case tracking-normal text-primary-charcoal/70 dark:text-gray-300">{tooltip.weekLabel}</span>
            </div>
          </div>
        ) : null}
      </div>
      {leaderboard ? <div className="mt-5 border-t border-secondary-sand/60 pt-5 dark:border-zinc-800">{leaderboard}</div> : null}
    </div>
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
      <span className="min-w-[128px] text-center tracking-[-0.01em]">{compactPeriodLabel(selectedSnapshot)}</span>
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

export function ExportPreviewModal({
  exportAthleteSelection,
  exportAthleteSelectionOptions,
  exportPhotoAdjustments,
  exporting,
  savingPhotoAdjustment,
  onClose,
  onDownload,
  onExportAthleteSelectionChange,
  onExportPhotoAdjustmentChange,
  onExportPhotoAdjustmentReset,
  onSaveAdjustedPhotoAdjustments,
  onSaveSelectedPhotoAdjustment,
  open,
  spec,
}: {
  exportAthleteSelection: ExportAthleteSelection;
  exportAthleteSelectionOptions: ExportAthleteSelectionOption[];
  exportPhotoAdjustments: ExportPhotoAdjustments;
  exporting: boolean;
  savingPhotoAdjustment: boolean;
  onClose: () => void;
  onDownload: () => void;
  onExportAthleteSelectionChange: (selection: ExportAthleteSelection) => void;
  onExportPhotoAdjustmentChange: (layoutMode: ExportLayoutMode, athleteId: string, adjustment: ExportPhotoAdjustment) => void;
  onExportPhotoAdjustmentReset: (layoutMode: ExportLayoutMode, athleteId: string) => void;
  onSaveAdjustedPhotoAdjustments: (layoutMode: ExportLayoutMode, athletes: RankedAthlete[]) => void;
  onSaveSelectedPhotoAdjustment: (layoutMode: ExportLayoutMode, athlete: RankedAthlete, adjustment: ExportPhotoAdjustment) => void;
  open: boolean;
  spec: LeaderboardSpec;
}) {
  const previewScale = 0.28;
  const layoutMode = exportLayoutModeForPreview(spec);
  const adjustableAthletes = useMemo(() => visibleExportPhotoAthletes(spec), [spec]);
  const currentLayoutAdjustments = exportPhotoAdjustments[layoutMode] ?? {};
  const adjustedVisibleAthletes = adjustableAthletes.filter((athlete) => currentLayoutAdjustments[athlete.id]);
  const adjustedSaveableCount = adjustedVisibleAthletes.filter((athlete) => athlete.athleteId).length;
  const [selectedAdjustAthleteId, setSelectedAdjustAthleteId] = useState(adjustableAthletes[0]?.id ?? "");
  const resolvedSelectedAdjustAthleteId = adjustableAthletes.some((athlete) => athlete.id === selectedAdjustAthleteId)
    ? selectedAdjustAthleteId
    : adjustableAthletes[0]?.id ?? "";
  const selectedAdjustAthlete = adjustableAthletes.find((athlete) => athlete.id === resolvedSelectedAdjustAthleteId);
  const selectedAdjustment = exportPhotoAdjustmentValue(exportPhotoAdjustments, layoutMode, selectedAdjustAthlete);
  const compactZoomMin = 0.8;
  const zoomMin = isCompactExportLayoutMode(layoutMode) ? compactZoomMin : 1;
  const displayZoom = Math.max(zoomMin, selectedAdjustment.zoom);
  const controlsDisabled = exporting || savingPhotoAdjustment;
  const selectedCanSave = Boolean(selectedAdjustAthlete?.athleteId);

  function updateSelectedAdjustment(patch: Partial<ExportPhotoAdjustment>) {
    if (!selectedAdjustAthlete) {
      return;
    }

    onExportPhotoAdjustmentChange(layoutMode, selectedAdjustAthlete.id, {
      ...selectedAdjustment,
      ...patch,
    });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-primary-charcoal/70 px-4 py-8 backdrop-blur-sm">
      <section
        aria-label="Preview export leaderboard"
        aria-modal="true"
        className="max-h-full w-full max-w-4xl overflow-auto rounded-2xl border border-secondary-sand/50 bg-primary-beige p-5 shadow-2xl dark:border-zinc-700 dark:bg-[#121212]"
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-poppins text-2xl font-bold text-primary-charcoal dark:text-gray-100">Preview Export</h2>
            <p className="mt-1 text-sm text-primary-charcoal/60 dark:text-gray-400">Poster PNG memakai desain export yang sudah ada.</p>
          </div>
          <button
            aria-label="Close export preview"
            className="grid size-10 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="overflow-auto rounded-xl bg-primary-charcoal p-4">
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
                  Athletes
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
                  Photo Adjust
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
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-primary-charcoal/55 dark:text-gray-400">
                      <span className="flex items-center justify-between gap-2">
                        Zoom
                        <span className="font-mono text-[10px] text-primary-charcoal/45 dark:text-gray-500">
                          {displayZoom.toFixed(2)}x
                        </span>
                      </span>
                      <input
                        className="accent-primary-brown"
                        disabled={controlsDisabled}
                        max="2.2"
                        min={zoomMin}
                        onChange={(event) => updateSelectedAdjustment({ zoom: Number(event.currentTarget.value) })}
                        step="0.05"
                        type="range"
                        value={displayZoom}
                      />
                    </label>
                    <label className="grid gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-primary-charcoal/55 dark:text-gray-400">
                      <span className="flex items-center justify-between gap-2">
                        Horizontal
                        <span className="font-mono text-[10px] text-primary-charcoal/45 dark:text-gray-500">
                          {Math.round(selectedAdjustment.x)}
                        </span>
                      </span>
                      <input
                        className="accent-primary-brown"
                        disabled={controlsDisabled}
                        max="40"
                        min="-40"
                        onChange={(event) => updateSelectedAdjustment({ x: Number(event.currentTarget.value) })}
                        step="1"
                        type="range"
                        value={selectedAdjustment.x}
                      />
                    </label>
                    <label className="grid gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-primary-charcoal/55 dark:text-gray-400">
                      <span className="flex items-center justify-between gap-2">
                        Vertical
                        <span className="font-mono text-[10px] text-primary-charcoal/45 dark:text-gray-500">
                          {Math.round(selectedAdjustment.y)}
                        </span>
                      </span>
                      <input
                        className="accent-primary-brown"
                        disabled={controlsDisabled}
                        max="40"
                        min="-40"
                        onChange={(event) => updateSelectedAdjustment({ y: Number(event.currentTarget.value) })}
                        step="1"
                        type="range"
                        value={selectedAdjustment.y}
                      />
                    </label>
                  </div>
                  <button
                    className={buttonClassName("mt-3 h-9 w-full border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100")}
                    disabled={controlsDisabled || !selectedAdjustAthlete}
                    onClick={() => selectedAdjustAthlete && onExportPhotoAdjustmentReset(layoutMode, selectedAdjustAthlete.id)}
                    type="button"
                  >
                    Reset
                  </button>
                  <div className="mt-2 grid gap-2">
                    <button
                      className={buttonClassName("h-9 w-full bg-primary-brown text-white shadow-[0_10px_22px_rgb(90,46,23,0.14)] hover:bg-primary-brown/90")}
                      disabled={controlsDisabled || !selectedAdjustAthlete || !selectedCanSave}
                      onClick={() =>
                        selectedAdjustAthlete && onSaveSelectedPhotoAdjustment(layoutMode, selectedAdjustAthlete, selectedAdjustment)
                      }
                      type="button"
                    >
                      <Save className="size-3.5" />
                      {savingPhotoAdjustment ? "Saving..." : "Save as Default"}
                    </button>
                    <button
                      className={buttonClassName("h-9 w-full border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-gray-100")}
                      disabled={controlsDisabled || adjustedSaveableCount <= 0}
                      onClick={() => onSaveAdjustedPhotoAdjustments(layoutMode, adjustedVisibleAthletes)}
                      type="button"
                    >
                      Save Adjusted
                    </button>
                  </div>
                  {!selectedCanSave ? (
                    <p className="mt-2 text-[11px] font-semibold leading-4 text-primary-charcoal/50 dark:text-gray-500">
                      Database athlete not linked.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-xs font-semibold leading-5 text-primary-charcoal/55 dark:text-gray-400">Tidak ada foto atlet untuk layout ini.</p>
              )}
            </div>
            <button
              className={buttonClassName("bg-primary-brown text-white shadow-[0_12px_30px_rgb(90,46,23,0.18)] hover:bg-primary-brown/90")}
              disabled={exporting}
              onClick={onDownload}
              type="button"
            >
              {exporting ? "Rendering..." : "Download PNG"}
            </button>
            <button
              className={buttonClassName("border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function chartDataFromSnapshots(snapshots: LeaderboardWeekSnapshot[]) {
  return buildBumpChartData(snapshots);
}
