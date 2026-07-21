"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import {
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { LeaderboardCanvas } from "./LeaderboardCanvas";
import { downloadExportFrame } from "@/lib/leaderboard/export-image";
import { lookupAthletesByName } from "@/lib/athletes/client-cache";
import { enrichAthletesWithDatabase } from "@/lib/athletes/enrichment";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import type { AthleteRecord } from "@/lib/athletes/types";
import { buildBumpChartData, type BumpChartData } from "@/lib/leaderboard/bump-chart";
import { parseCsvInput, parseJsonInput, parseSpreadsheetRows } from "@/lib/leaderboard/importers";
import { formatMetricValue, normalizeMetricValue, sumMetricValues } from "@/lib/leaderboard/metrics";
import {
  createInitialProjectState,
  migrateStoredProjectState,
  updateProjectDraft,
  type LeaderboardProjectState,
} from "@/lib/leaderboard/project-state";
import { buildLeaderboardRows } from "@/lib/leaderboard/ranking";
import { DEFAULT_SPEC } from "@/lib/leaderboard/schema";
import {
  DEFAULT_LEADERBOARD_TEMPLATE_ID,
  DEFAULT_SEASON_YEAR,
  DEFAULT_WEEK_NUMBER,
  FIXED_FOOTER_QUOTE,
  LEADERBOARD_TEMPLATES,
  deriveCurrentTrendTotal,
  derivePreviousWeekTotal,
  deriveSeasonWeekFields,
  leaderboardTemplateToSpecPatch,
  type LeaderboardTemplateId,
} from "@/lib/leaderboard/templates";
import { OUTPUT_DIMENSIONS, type AthleteEntry, type LeaderboardSpec, type OutputFormat } from "@/lib/leaderboard/types";
import { GLOBAL_LEADERBOARD_CLIENT_ID } from "@/lib/leaderboard/constants";
import {
  LeaderboardWeekSnapshotSchema,
  upsertWeekSnapshot,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";
import { cn } from "@/lib/utils";

const ADMIN_TOKEN_STORAGE_KEY = "altruist-leaderboard-admin-token:v1";
const STORY_FORMAT: OutputFormat = "story";
const PREVIEW_SCALE = 0.18;

function normalizeTemplateId(value: unknown): LeaderboardTemplateId {
  const text = String(value ?? "");
  return (LEADERBOARD_TEMPLATES.find((template) => template.id === text)?.id ?? DEFAULT_LEADERBOARD_TEMPLATE_ID) as LeaderboardTemplateId;
}

function deriveDashboardSpec(
  spec: LeaderboardSpec,
  seasonYear: string,
  weekNumber: string,
  templateId: LeaderboardTemplateId,
): LeaderboardSpec {
  const trendValues = spec.trendValues.filter((value) => Number.isFinite(value));

  return {
    ...spec,
    ...deriveSeasonWeekFields(seasonYear, weekNumber),
    ...leaderboardTemplateToSpecPatch(templateId),
    communityName: "ALTRUIST SEHAT",
    logoDataUrl: undefined,
    previousWeekTotal: derivePreviousWeekTotal(trendValues),
    quote: FIXED_FOOTER_QUOTE,
    trendValues,
  };
}

const DEFAULT_DRAFT = createInitialProjectState({
  spec: deriveDashboardSpec(DEFAULT_SPEC, DEFAULT_SEASON_YEAR, DEFAULT_WEEK_NUMBER, DEFAULT_LEADERBOARD_TEMPLATE_ID),
  seasonYear: DEFAULT_SEASON_YEAR,
  weekNumber: DEFAULT_WEEK_NUMBER,
  templateId: DEFAULT_LEADERBOARD_TEMPLATE_ID,
});

function nextAthlete(): AthleteEntry {
  return {
    id: `athlete-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    name: "",
    value: 0,
  };
}

function currentSnapshotFromDraft(draft: LeaderboardProjectState): LeaderboardWeekSnapshot {
  const ranked = buildLeaderboardRows(draft.spec.athletes, 10);

  return {
    clientId: GLOBAL_LEADERBOARD_CLIENT_ID,
    seasonYear: draft.seasonYear,
    weekNumber: draft.weekNumber,
    templateId: draft.templateId,
    spec: draft.spec,
    total: sumMetricValues(draft.spec.athletes),
    athleteCount: ranked.length,
    exportedAt: draft.updatedAt,
  };
}

function buildTrendValues(snapshots: LeaderboardWeekSnapshot[], draft: LeaderboardProjectState): number[] {
  const merged = upsertWeekSnapshot(snapshots, currentSnapshotFromDraft(draft));
  return merged
    .slice()
    .sort((left, right) => new Date(left.exportedAt).getTime() - new Date(right.exportedAt).getTime())
    .map((snapshot) => snapshot.total)
    .filter((value) => Number.isFinite(value));
}

function Button({
  children,
  className,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function inputClassName(className?: string) {
  return cn(
    "w-full rounded-xl border border-secondary-sand/70 bg-white px-3 py-2.5 text-sm font-medium text-primary-charcoal outline-none transition placeholder:text-primary-charcoal/35 focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100",
    className,
  );
}

function fieldLabelClassName() {
  return "grid gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary-charcoal/55 dark:text-gray-400";
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-secondary-sand/60 bg-white/82 p-4 shadow-[0_12px_32px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mb-4 grid size-10 place-items-center rounded-xl bg-secondary-sand/45 text-primary-brown dark:bg-zinc-800 dark:text-secondary-sand">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary-charcoal/50 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary-charcoal dark:text-gray-100">{value}</p>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-secondary-sand bg-white/60 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/55">
      <p className="font-poppins text-lg font-semibold text-primary-charcoal dark:text-gray-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-primary-charcoal/60 dark:text-gray-400">{message}</p>
    </div>
  );
}

function LeaderboardPodium({ athletes, metric }: { athletes: ReturnType<typeof buildLeaderboardRows>; metric: LeaderboardSpec["metric"] }) {
  const podium = athletes.slice(0, 3);
  if (!podium.length) {
    return <EmptyState title="Belum ada podium" message="Import atau isi data atlet untuk membentuk top 3." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {podium.map((athlete) => (
        <div
          className={cn(
            "rounded-2xl border bg-white p-5 shadow-[0_16px_38px_rgb(90,46,23,0.07)] dark:border-zinc-800 dark:bg-zinc-900",
            athlete.rank === 1 ? "border-primary-brown/25 md:-mt-3" : "border-secondary-sand/60",
          )}
          key={athlete.id}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-primary-brown text-lg font-bold text-white">
              {athlete.rank}
            </div>
            <Trophy className={cn("size-5", athlete.rank === 1 ? "text-primary-brown" : "text-primary-green")} />
          </div>
          <p className="mt-5 truncate font-poppins text-xl font-bold text-primary-charcoal dark:text-gray-100">{athlete.name}</p>
          <p className="mt-1 text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">
            {formatMetricValue(athlete.value, metric)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LeaderboardTable({ athletes, metric }: { athletes: ReturnType<typeof buildLeaderboardRows>; metric: LeaderboardSpec["metric"] }) {
  if (!athletes.length) {
    return <EmptyState title="Belum ada ranking" message="Data ranking akan muncul setelah ada atlet dan nilai leaderboard." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-secondary-sand/60 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-[72px_minmax(0,1fr)_130px] border-b border-secondary-sand/50 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-primary-charcoal/50 dark:border-zinc-800 dark:text-gray-500">
        <span>Rank</span>
        <span>Athlete</span>
        <span className="text-right">Result</span>
      </div>
      {athletes.map((athlete) => (
        <div
          className="grid grid-cols-[72px_minmax(0,1fr)_130px] items-center border-b border-secondary-sand/35 px-4 py-3 last:border-b-0 dark:border-zinc-800"
          key={athlete.id}
        >
          <span className="font-poppins text-lg font-bold text-primary-brown dark:text-secondary-sand">#{athlete.rank}</span>
          <span className="truncate font-semibold text-primary-charcoal dark:text-gray-100">{athlete.name}</span>
          <span className="text-right text-sm font-bold text-primary-green dark:text-secondary-teal">
            {formatMetricValue(athlete.value, metric)}
          </span>
        </div>
      ))}
    </div>
  );
}

function BumpChart({ data }: { data: BumpChartData }) {
  const width = 860;
  const height = 390;
  const padding = { top: 28, right: 44, bottom: 42, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const colors = ["#5A2E17", "#5E7A5E", "#C49A7C", "#7EC8C1", "#B7D6E6", "#8C5A3B", "#2F6F73", "#92754B", "#3E4F3E", "#1F1F1F"];

  if (!data.weeks.length || !data.series.length) {
    return <EmptyState title="Bump chart belum tersedia" message="Simpan data beberapa minggu untuk melihat pergerakan ranking atlet." />;
  }

  const xForWeek = (index: number) => padding.left + (data.weeks.length === 1 ? innerWidth / 2 : (index / (data.weeks.length - 1)) * innerWidth);
  const yForRank = (rank: number) => padding.top + ((rank - 1) / Math.max(1, data.maxRank - 1)) * innerHeight;
  const weekIndex = new Map(data.weeks.map((week, index) => [week.key, index]));

  return (
    <div className="overflow-x-auto rounded-2xl border border-secondary-sand/60 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <svg aria-label="Bump chart ranking atlet" className="min-w-[720px]" role="img" viewBox={`0 0 ${width} ${height}`}>
        {Array.from({ length: data.maxRank }, (_, index) => {
          const rank = index + 1;
          const y = yForRank(rank);
          return (
            <g key={rank}>
              <line stroke="#E6D7C2" strokeDasharray={rank === 1 ? "0" : "4 7"} strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text fill="#5A2E17" fontSize="12" fontWeight="700" textAnchor="end" x={padding.left - 14} y={y + 4}>
                {rank}
              </text>
            </g>
          );
        })}
        {data.weeks.map((week, index) => {
          const x = xForWeek(index);
          return (
            <g key={week.key}>
              <line stroke="#E6D7C2" strokeWidth="1" x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} />
              <text fill="#5A2E17" fontSize="13" fontWeight="800" textAnchor="middle" x={x} y={height - 14}>
                {week.label}
              </text>
            </g>
          );
        })}
        {data.series.map((series, seriesIndex) => {
          const points = series.points
            .map((point) => {
              const index = weekIndex.get(point.weekKey);
              return index === undefined || point.rank === null ? undefined : { ...point, rank: point.rank, x: xForWeek(index), y: yForRank(point.rank) };
            })
            .filter((point): point is BumpChartData["series"][number]["points"][number] & { rank: number; x: number; y: number } => Boolean(point));
          const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
          const color = colors[seriesIndex % colors.length];

          return (
            <g key={series.key}>
              <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
              {points.map((point) => (
                <circle cx={point.x} cy={point.y} fill="#F5F1EB" key={`${series.key}:${point.weekKey}`} r="5.5" stroke={color} strokeWidth="3" />
              ))}
              {points.length ? (
                <text fill={color} fontSize="12" fontWeight="800" x={points[points.length - 1].x + 10} y={points[points.length - 1].y + 4}>
                  {series.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LeaderboardDashboard() {
  const [draft, setDraft] = useState<LeaderboardProjectState>(DEFAULT_DRAFT);
  const [snapshots, setSnapshots] = useState<LeaderboardWeekSnapshot[]>([]);
  const [pasteValue, setPasteValue] = useState("Utha,128.4\nAndi,120.1\nBudi,112.3");
  const [adminToken, setAdminToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState("Read-only");
  const [exporting, setExporting] = useState(false);
  const exportFrameRef = useRef<HTMLDivElement>(null);

  const ranked = useMemo(() => buildLeaderboardRows(draft.spec.athletes, 10), [draft.spec.athletes]);
  const total = useMemo(() => sumMetricValues(draft.spec.athletes), [draft.spec.athletes]);
  const displaySnapshots = useMemo(() => upsertWeekSnapshot(snapshots, currentSnapshotFromDraft(draft)), [draft, snapshots]);
  const bumpChartData = useMemo(() => buildBumpChartData(displaySnapshots), [displaySnapshots]);
  const trendValues = useMemo(() => buildTrendValues(snapshots, draft), [draft, snapshots]);
  const displaySpec = useMemo(
    () => ({
      ...draft.spec,
      trendValues,
      previousWeekTotal: derivePreviousWeekTotal(trendValues),
    }),
    [draft.spec, trendValues],
  );
  const displayTotal = deriveCurrentTrendTotal(displaySpec.trendValues, total);
  const canEdit = adminToken.trim().length > 0;

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminToken(savedToken);

    async function loadLeaderboard() {
      setLoading(true);
      setLoadError(null);
      try {
        const [projectResponse, snapshotResponse] = await Promise.all([
          fetch("/api/leaderboard/projects/latest", { headers: { Accept: "application/json" } }),
          fetch("/api/leaderboard/week-snapshots", { headers: { Accept: "application/json" } }),
        ]);

        if (projectResponse.ok) {
          const payload = (await projectResponse.json().catch(() => null)) as { project?: unknown } | null;
          const project = migrateStoredProjectState(payload?.project);
          if (project) {
            setDraft(project);
          }
        } else {
          setLoadError("Database leaderboard belum siap. Dashboard memakai data contoh sementara.");
        }

        if (snapshotResponse.ok) {
          const payload = (await snapshotResponse.json().catch(() => null)) as { snapshots?: unknown[] } | null;
          const parsed = (payload?.snapshots ?? [])
            .map((snapshot) => LeaderboardWeekSnapshotSchema.safeParse(snapshot))
            .filter((result): result is ReturnType<typeof LeaderboardWeekSnapshotSchema.safeParse> & { success: true } => result.success)
            .map((result) => result.data);
          setSnapshots(parsed);
        }
      } catch {
        setLoadError("Dashboard belum bisa terhubung ke database leaderboard.");
      } finally {
        setLoading(false);
        setHydrated(true);
      }
    }

    void loadLeaderboard();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
  }, [adminToken]);

  useEffect(() => {
    if (!hydrated || !dirty || !canEdit) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const token = adminToken.trim();
      const snapshot = currentSnapshotFromDraft(draft);
      setStatus("Saving...");

      Promise.all([
        fetch("/api/leaderboard/projects/latest", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ project: draft }),
        }),
        fetch("/api/leaderboard/week-snapshots", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ snapshot }),
        }),
      ])
        .then(async ([projectResponse, snapshotResponse]) => {
          if (!projectResponse.ok || !snapshotResponse.ok) {
            const failed = !projectResponse.ok ? projectResponse : snapshotResponse;
            const payload = await failed.json().catch(() => null);
            const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : failed.statusText;
            throw new Error(message);
          }

          setSnapshots((current) => upsertWeekSnapshot(current, snapshot));
          setDirty(false);
          setStatus("Saved");
        })
        .catch((error) => {
          setStatus(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [adminToken, canEdit, dirty, draft, hydrated]);

  function commitDraft(next: LeaderboardProjectState) {
    setDraft(next);
    setDirty(true);
    setStatus(canEdit ? "Unsaved changes" : "Enter admin token to save");
  }

  function updateSpec(patch: Partial<LeaderboardSpec>) {
    commitDraft(updateProjectDraft(draft, { spec: { ...draft.spec, ...patch } }));
  }

  function updatePeriod(patch: Partial<Pick<LeaderboardProjectState, "seasonYear" | "weekNumber" | "templateId">>) {
    const seasonYear = patch.seasonYear ?? draft.seasonYear;
    const weekNumber = patch.weekNumber ?? draft.weekNumber;
    const templateId = normalizeTemplateId(patch.templateId ?? draft.templateId);

    commitDraft(
      updateProjectDraft(draft, {
        seasonYear,
        weekNumber,
        templateId,
        spec: deriveDashboardSpec(draft.spec, seasonYear, weekNumber, templateId),
      }),
    );
  }

  function updateAthlete(id: string, patch: Partial<AthleteEntry>) {
    updateSpec({
      athletes: draft.spec.athletes.map((athlete) => (athlete.id === id ? { ...athlete, ...patch } : athlete)),
    });
  }

  async function enrichImportedAthletes(athletes: AthleteEntry[]): Promise<AthleteEntry[]> {
    if (!athletes.length) {
      return athletes;
    }

    try {
      const lookup = await lookupAthletesByName(athletes.map((athlete) => athlete.name));
      const matched: AthleteRecord[] = [];
      athletes.forEach((athlete) => {
        const record = lookup.get(normalizeAthleteName(athlete.name));
        if (record) {
          matched.push(record);
        }
      });
      return enrichAthletesWithDatabase(athletes, matched).athletes;
    } catch {
      return athletes;
    }
  }

  async function replaceAthletes(athletes: AthleteEntry[]) {
    const enriched = await enrichImportedAthletes(athletes);
    updateSpec({ athletes: enriched.length ? enriched : draft.spec.athletes });
    setStatus(`Imported ${enriched.length} athletes`);
  }

  async function handlePasteImport() {
    if (!canEdit) {
      return;
    }

    try {
      const trimmed = pasteValue.trim();
      if (!trimmed) {
        throw new Error("Paste leaderboard data first.");
      }

      const athletes = trimmed.startsWith("[") || trimmed.startsWith("{")
        ? parseJsonInput(trimmed, draft.spec.metric)
        : parseCsvInput(trimmed, draft.spec.metric);
      await replaceAthletes(athletes);
    } catch (error) {
      setStatus(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canEdit) {
      return;
    }

    try {
      await replaceAthletes(parseCsvInput(await file.text(), draft.spec.metric));
    } catch (error) {
      setStatus(`CSV failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleXlsxUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canEdit) {
      return;
    }

    try {
      const rows = await readSheet(file);
      await replaceAthletes(parseSpreadsheetRows(rows, draft.spec.metric));
    } catch (error) {
      setStatus(`XLSX failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleExport() {
    setExporting(true);
    setStatus("Rendering PNG...");

    try {
      await downloadExportFrame(exportFrameRef.current, STORY_FORMAT);
      setStatus("PNG downloaded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <Navbar />
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary-sand/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-brown dark:bg-zinc-800 dark:text-secondary-sand">
              <Sparkles className="size-4" />
              Altruist Sehat Leaderboard
            </div>
            <h1 className="font-poppins text-4xl font-bold tracking-normal text-primary-charcoal dark:text-gray-100 md:text-5xl">
              Leaderboard Komunitas
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-primary-charcoal/65 dark:text-gray-400">
              Pantau ranking mingguan, pergerakan atlet, dan hasil terbaru komunitas dari satu dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100" disabled={loading} onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button className="bg-primary-brown text-white shadow-[0_12px_30px_rgb(90,46,23,0.18)] hover:bg-primary-brown/90" disabled={exporting || !ranked.length} onClick={handleExport}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PNG
            </Button>
          </div>
        </div>

        {loadError ? (
          <div className="mb-6 rounded-2xl border border-secondary-clay/40 bg-secondary-clay/15 px-4 py-3 text-sm font-semibold text-primary-brown dark:border-secondary-clay/30 dark:bg-secondary-clay/10 dark:text-secondary-sand">
            {loadError}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-secondary-sand/60 bg-white/70 px-4 py-3 text-sm font-semibold text-primary-charcoal/65 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-gray-400">
          <span className="inline-flex items-center gap-2">
            <Activity className="size-4 text-primary-green" />
            {draft.spec.dateRange}
          </span>
          <span>{draft.spec.leaderboardMetric}</span>
          <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1", canEdit ? "bg-primary-green/10 text-primary-green" : "bg-secondary-sand/55 text-primary-brown dark:bg-zinc-800 dark:text-secondary-sand")}>
            {canEdit ? <ShieldCheck className="size-4" /> : <Lock className="size-4" />}
            {canEdit ? "Admin enabled" : "Read-only"}
          </span>
          <span className="ml-auto">{status}</span>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Trophy className="size-5" />} label="Periode" value={`${draft.seasonYear} / W${draft.weekNumber}`} />
          <StatCard icon={<Activity className="size-5" />} label="Total" value={formatMetricValue(displayTotal, draft.spec.metric)} />
          <StatCard icon={<Users className="size-5" />} label="Atlet" value={`${ranked.length}`} />
          <StatCard icon={<BarChart3 className="size-5" />} label="Minggu data" value={`${bumpChartData.weeks.length}`} />
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-8">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-poppins text-2xl font-bold text-primary-charcoal dark:text-gray-100">Bump Chart Ranking</h2>
                <span className="text-sm font-semibold text-primary-charcoal/50 dark:text-gray-500">Top 10 latest athletes</span>
              </div>
              <BumpChart data={bumpChartData} />
            </section>

            <section>
              <h2 className="mb-4 font-poppins text-2xl font-bold text-primary-charcoal dark:text-gray-100">Podium</h2>
              <LeaderboardPodium athletes={ranked} metric={draft.spec.metric} />
            </section>

            <section>
              <h2 className="mb-4 font-poppins text-2xl font-bold text-primary-charcoal dark:text-gray-100">Ranking Terbaru</h2>
              <LeaderboardTable athletes={ranked} metric={draft.spec.metric} />
            </section>
          </div>

          <aside className="grid gap-5">
            <section className="rounded-2xl border border-secondary-sand/60 bg-white/82 p-5 shadow-[0_12px_32px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900/82">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-poppins text-xl font-bold">Admin Panel</h2>
                <KeyRound className="size-5 text-primary-brown dark:text-secondary-sand" />
              </div>
              <label className={fieldLabelClassName()}>
                Admin token
                <input
                  className={inputClassName()}
                  onChange={(event) => setAdminToken(event.target.value)}
                  placeholder="Bearer token"
                  type="password"
                  value={adminToken}
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className={fieldLabelClassName()}>
                  Season
                  <input
                    className={inputClassName()}
                    disabled={!canEdit}
                    min="1"
                    onChange={(event) => updatePeriod({ seasonYear: event.target.value })}
                    type="number"
                    value={draft.seasonYear}
                  />
                </label>
                <label className={fieldLabelClassName()}>
                  Week
                  <input
                    className={inputClassName()}
                    disabled={!canEdit}
                    min="1"
                    onChange={(event) => updatePeriod({ weekNumber: event.target.value })}
                    type="number"
                    value={draft.weekNumber}
                  />
                </label>
              </div>
              <label className={cn(fieldLabelClassName(), "mt-4")}>
                Template
                <select
                  className={inputClassName()}
                  disabled={!canEdit}
                  onChange={(event) => updatePeriod({ templateId: normalizeTemplateId(event.target.value) })}
                  value={draft.templateId}
                >
                  {LEADERBOARD_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="rounded-2xl border border-secondary-sand/60 bg-white/82 p-5 shadow-[0_12px_32px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900/82">
              <h2 className="mb-4 font-poppins text-xl font-bold">Import Data</h2>
              <label className={fieldLabelClassName()}>
                Paste CSV / JSON
                <textarea
                  className={inputClassName("min-h-28 font-mono")}
                  disabled={!canEdit}
                  onChange={(event) => setPasteValue(event.target.value)}
                  value={pasteValue}
                />
              </label>
              <div className="mt-4 grid gap-2">
                <Button className="bg-primary-green text-white hover:bg-primary-green/90" disabled={!canEdit} onClick={handlePasteImport}>
                  <Upload className="size-4" />
                  Import Paste
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <label className={cn("inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-secondary-sand bg-white text-sm font-semibold text-primary-charcoal transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100", !canEdit && "pointer-events-none opacity-55")}>
                    <FileSpreadsheet className="size-4" />
                    CSV
                    <input accept=".csv,text/csv" className="sr-only" onChange={handleCsvUpload} type="file" />
                  </label>
                  <label className={cn("inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-secondary-sand bg-white text-sm font-semibold text-primary-charcoal transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100", !canEdit && "pointer-events-none opacity-55")}>
                    <FileSpreadsheet className="size-4" />
                    XLSX
                    <input accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={handleXlsxUpload} type="file" />
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-secondary-sand/60 bg-white/82 p-5 shadow-[0_12px_32px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900/82">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-poppins text-xl font-bold">Edit Atlet</h2>
                <Button className="h-9 bg-secondary-sand/60 px-3 text-primary-brown hover:bg-secondary-sand dark:bg-zinc-800 dark:text-secondary-sand" disabled={!canEdit} onClick={() => updateSpec({ athletes: [...draft.spec.athletes, nextAthlete()] })}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
                {draft.spec.athletes.map((athlete, index) => (
                  <div className="grid grid-cols-[28px_minmax(0,1fr)_90px_34px] items-center gap-2" key={athlete.id}>
                    <span className="text-xs font-bold text-primary-charcoal/45 dark:text-gray-500">#{index + 1}</span>
                    <input
                      className={inputClassName("h-10")}
                      disabled={!canEdit}
                      onChange={(event) => updateAthlete(athlete.id, { name: event.target.value, normalizedName: normalizeAthleteName(event.target.value) })}
                      placeholder="Athlete"
                      value={athlete.name}
                    />
                    <input
                      className={inputClassName("h-10")}
                      disabled={!canEdit}
                      onChange={(event) => updateAthlete(athlete.id, { value: normalizeMetricValue(event.target.value, draft.spec.metric) })}
                      value={athlete.value}
                    />
                    <button
                      aria-label={`Remove ${athlete.name || `athlete ${index + 1}`}`}
                      className="grid size-9 place-items-center rounded-xl border border-secondary-sand bg-white text-primary-charcoal/55 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-400"
                      disabled={!canEdit}
                      onClick={() => {
                        const remaining = draft.spec.athletes.filter((row) => row.id !== athlete.id);
                        updateSpec({ athletes: remaining.length ? remaining : [nextAthlete()] });
                      }}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-secondary-sand/60 bg-white/82 p-5 shadow-[0_12px_32px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900/82">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-poppins text-xl font-bold">Preview Export</h2>
                <Download className="size-5 text-primary-brown dark:text-secondary-sand" />
              </div>
              <div className="overflow-hidden rounded-xl bg-primary-charcoal/95 p-3">
                <div
                  style={
                    {
                      height: `${OUTPUT_DIMENSIONS[STORY_FORMAT].height * PREVIEW_SCALE}px`,
                      width: `${OUTPUT_DIMENSIONS[STORY_FORMAT].width * PREVIEW_SCALE}px`,
                    } as CSSProperties
                  }
                >
                  <div
                    ref={exportFrameRef}
                    style={{
                      height: OUTPUT_DIMENSIONS[STORY_FORMAT].height,
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: "top left",
                      width: OUTPUT_DIMENSIONS[STORY_FORMAT].width,
                    }}
                  >
                    <LeaderboardCanvas format={STORY_FORMAT} spec={displaySpec} />
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
