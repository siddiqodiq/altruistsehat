"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Dumbbell,
  Edit3,
  FileSpreadsheet,
  Footprints,
  KeyRound,
  LogIn,
  Plus,
  Save,
  Trash2,
  Upload,
  Waves,
} from "lucide-react";
import { updateAthletePhotoAdjustments } from "@/lib/athletes/api";
import { clearAthleteLookupCache, lookupAthletesByName } from "@/lib/athletes/client-cache";
import { enrichAthletesWithDatabase } from "@/lib/athletes/enrichment";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import type { AthleteRecord } from "@/lib/athletes/types";
import { parseCsvInput, parseJsonInput, parseSpreadsheetRows } from "@/lib/leaderboard/importers";
import { formatMetricValue, normalizeMetricValue, sumMetricValues } from "@/lib/leaderboard/metrics";
import { updateProjectDraft, type LeaderboardProjectState } from "@/lib/leaderboard/project-state";
import { buildLeaderboardRows } from "@/lib/leaderboard/ranking";
import {
  DEFAULT_LEADERBOARD_CATEGORY,
  LEADERBOARD_CATEGORIES,
  categoryConfigForId,
  defaultSportMetricOptions,
  filterSnapshotsByCategory,
  templateIdForCategory,
  type LeaderboardCategoryId,
} from "@/lib/leaderboard/categories";
import type {
  AthleteEntry,
  ExportLayoutMode,
  ExportPhotoAdjustment,
  ExportPhotoAdjustments,
  LeaderboardSpec,
  MetricType,
  RankedAthlete,
} from "@/lib/leaderboard/types";
import {
  UNSAVED_ADMIN_CHANGES_STORAGE_KEY,
  athleteCellKey,
  changedAthleteCellKeys,
  countLeaderboardDraftChanges,
  formatDeleteWeekSuccessMessage,
  getAdminLeaderboardContextSummary,
  getDeleteWeekTarget,
  isDevelopmentAdminToken,
  type EditableAthleteField,
} from "@/lib/leaderboard/admin-management";
import {
  ADMIN_TOKEN_STORAGE_KEY,
  createCategoryDraft,
  createInitialCategoryDrafts,
  currentSnapshotFromDraft,
  normalizeCategoryProjectState,
  snapshotKey,
  STORY_FORMAT,
} from "@/lib/leaderboard/dashboard-state";
import {
  downloadLeaderboardPng,
  exportAthleteSelectionOptions,
  clampExportPhotoAdjustment,
  specWithDatabaseAthletePhotos,
  specWithExportAthleteSelection,
  specWithTrend,
  type ExportAthleteSelection,
} from "@/lib/leaderboard/export-client";
import {
  LeaderboardWeekSnapshotSchema,
  compareSnapshotsByWeekAsc,
  upsertWeekSnapshot,
  weekIndexFromWeekNumber,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";
import { buildSeasonWeekCalendar, shiftMonthIso } from "@/lib/leaderboard/templates";
import {
  EmptyState,
  ExportPreviewModal,
  buttonClassName,
  fieldLabelClassName,
  inputClassName,
} from "./LeaderboardUi";
import { buildLeaderboardStory } from "@/lib/leaderboard/story";
import { cn } from "@/lib/utils";

function nextAthlete(): AthleteEntry {
  return {
    id: `athlete-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    name: "",
    normalizedName: "",
    value: 0,
  };
}

function athleteKey(athlete: Pick<AthleteEntry, "athleteId" | "normalizedName" | "name">) {
  return athlete.athleteId ?? athlete.normalizedName ?? normalizeAthleteName(athlete.name);
}

interface PendingAthleteDelete {
  id: string;
  name: string;
}

interface DeleteWeekTarget {
  dateRange?: string;
  seasonYear: string;
  templateId: string;
  weekNumber: string;
}

interface PendingViewChange {
  category: LeaderboardCategoryId;
  seasonYear: string;
  weekNumber: string;
}

interface ExportPhotoAdjustmentSaveTarget {
  athlete: RankedAthlete;
  adjustment: ExportPhotoAdjustment;
}

interface SaveableExportPhotoAdjustmentTarget {
  athlete: RankedAthlete & { athleteId: string };
  adjustment: ExportPhotoAdjustment;
}

function compactDateRangeLabel(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);

  if (!match) {
    return value;
  }

  const [, startDay, startMonthRaw, startYear, endDay, endMonthRaw, endYear] = match;
  const startMonth = startMonthRaw.slice(0, 3);
  const endMonth = endMonthRaw.slice(0, 3);

  if (startMonth.toLowerCase() === endMonth.toLowerCase() && startYear === endYear) {
    return `${startDay}–${endDay} ${endMonth} ${endYear}`;
  }

  if (startYear === endYear) {
    return `${startDay} ${startMonth}–${endDay} ${endMonth} ${endYear}`;
  }

  return `${startDay} ${startMonth} ${startYear}–${endDay} ${endMonth} ${endYear}`;
}

function metricInputMode(metric: MetricType): "decimal" | "numeric" {
  return metric === "time_minutes" ? "numeric" : "decimal";
}

function metricInputStep(metric: MetricType): string {
  return metric === "time_minutes" ? "1" : "0.01";
}

function importPlaceholder(metric: MetricType): string {
  if (metric === "time_minutes") {
    return "name,time\nFikri NA,550\nFarid Akbar,50";
  }

  return "Name, value";
}

const sportIcons = {
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  weight_training: Dumbbell,
} satisfies Record<LeaderboardCategoryId, typeof Footprints>;

function AdminContextBar({
  adminLoginError,
  adminTokenInput,
  athleteTotal,
  canEdit,
  context,
  draft,
  selectedCategory,
  status,
  onAdminLogin,
  onAdminTokenInputChange,
  onCategorySelect,
  onViewChange,
  onTotalOverrideChange,
}: {
  adminLoginError: string;
  adminTokenInput: string;
  athleteTotal: number;
  canEdit: boolean;
  context: ReturnType<typeof getAdminLeaderboardContextSummary>;
  draft: LeaderboardProjectState;
  selectedCategory: LeaderboardCategoryId;
  status: string;
  onAdminLogin: () => void;
  onAdminTokenInputChange: (value: string) => void;
  onCategorySelect: (category: LeaderboardCategoryId) => void;
  onViewChange: (patch: Partial<Pick<LeaderboardProjectState, "seasonYear" | "weekNumber">>) => void;
  onTotalOverrideChange: (value: string) => void;
}) {
  const sportOptions = useMemo(() => defaultSportMetricOptions(), []);
  const selectedSportOption = sportOptions.find((option) => option.categoryId === selectedCategory) ?? sportOptions[0];
  const activeCalendar = useMemo(() => buildSeasonWeekCalendar(context.season, context.week), [context.season, context.week]);
  const [calendarMonthIso, setCalendarMonthIso] = useState(activeCalendar.monthStartIso);
  const calendar = useMemo(
    () => buildSeasonWeekCalendar(context.season, context.week, calendarMonthIso),
    [calendarMonthIso, context.season, context.week],
  );

  useEffect(() => {
    setCalendarMonthIso(activeCalendar.monthStartIso);
  }, [activeCalendar.monthStartIso]);

  return (
    <section
      aria-label="Konteks leaderboard aktif"
      className="min-w-0 rounded-[1.35rem] border border-secondary-sand/70 bg-white/95 p-4 shadow-[0_14px_34px_rgb(90,46,23,0.08)] dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-secondary-sand/50 pb-3 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
            Development Mode
          </span>
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-xs font-black",
              canEdit
                ? "border-primary-green/25 bg-primary-green/10 text-primary-green dark:border-secondary-teal/30 dark:bg-secondary-teal/10 dark:text-secondary-teal"
                : "border-secondary-sand bg-secondary-sand/25 text-primary-charcoal/55 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300",
            )}
          >
            {canEdit ? "Admin aktif" : "Admin belum aktif"}
          </span>
          <span className="text-xs font-semibold text-primary-charcoal/50 dark:text-gray-400">{status}</span>
        </div>

        {!canEdit ? (
          <div className="grid gap-1 sm:min-w-[360px]">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative min-w-0 flex-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-charcoal/35" />
                <input
                  className={inputClassName("h-10 pl-9")}
                  onChange={(event) => onAdminTokenInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onAdminLogin();
                    }
                  }}
                  placeholder="Admin token"
                  type="password"
                  value={adminTokenInput}
                />
              </label>
              <button className={buttonClassName("h-10 w-full bg-primary-green px-3 text-white hover:bg-primary-green/90 sm:w-auto")} onClick={onAdminLogin} type="button">
                <LogIn className="size-4" />
                Login
              </button>
            </div>
            {adminLoginError ? <span className="text-xs font-semibold text-red-600 dark:text-red-300">{adminLoginError}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(280px,0.55fr)_minmax(0,1fr)]">
        <div className="grid gap-3">
          <div className="rounded-[1.1rem] border border-primary-green/20 bg-primary-green/10 p-4 text-primary-charcoal dark:border-secondary-teal/25 dark:bg-secondary-teal/10 dark:text-gray-100">
            <div className="flex items-center gap-2 text-primary-green dark:text-secondary-teal">
              <CalendarDays className="size-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">Viewing</span>
            </div>
            <p className="mt-3 font-poppins text-2xl font-black leading-tight">{activeCalendar.activeRange.compactDateRange}</p>
            <p className="mt-2 text-sm font-bold text-primary-charcoal/60 dark:text-gray-400">
              Season {context.season} · {selectedSportOption.sportLabel} · {selectedSportOption.metricLabel}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid content-center gap-1 rounded-xl border border-secondary-sand/60 bg-primary-beige/35 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">Atlet</span>
              <span className="truncate text-sm font-black text-primary-charcoal dark:text-gray-100">{context.athletes}</span>
            </div>
            <div className="grid content-center gap-1 rounded-xl border border-secondary-sand/60 bg-primary-beige/35 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">Total</span>
              <span className="truncate text-sm font-black text-primary-charcoal dark:text-gray-100">{context.total}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div className="rounded-[1.1rem] border border-secondary-sand/60 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary-charcoal/45 dark:text-gray-500">Periode</p>
                  <p className="mt-1 text-sm font-black text-primary-charcoal dark:text-gray-100">{calendar.monthLabel}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label="Bulan sebelumnya"
                    className="grid size-9 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal/70 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
                    onClick={() => setCalendarMonthIso((value) => shiftMonthIso(value, -1))}
                    type="button"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    aria-label="Bulan berikutnya"
                    className="grid size-9 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal/70 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
                    onClick={() => setCalendarMonthIso((value) => shiftMonthIso(value, 1))}
                    type="button"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {calendar.weeks.map((week) => {
                  const isActive = week.weekValue === activeCalendar.activeRange.weekValue;
                  return (
                    <button
                      aria-pressed={isActive}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                        isActive
                          ? "border-primary-green bg-primary-green text-white shadow-[0_10px_22px_rgb(94,122,94,0.18)] dark:border-secondary-teal dark:bg-secondary-teal dark:text-zinc-950"
                          : "border-secondary-sand bg-primary-beige/20 text-primary-charcoal hover:border-primary-green/40 hover:bg-primary-green/10 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-gray-100 dark:hover:border-secondary-teal/60",
                      )}
                      disabled={!canEdit}
                      key={week.weekValue}
                      onClick={() => onViewChange({ weekNumber: week.weekValue })}
                      type="button"
                    >
                      {week.compactDateRange}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3">
              <label className={fieldLabelClassName()}>
                Season
                <input
                  className={inputClassName("h-10")}
                  disabled={!canEdit}
                  min="1"
                  onChange={(event) => onViewChange({ seasonYear: event.target.value })}
                  type="number"
                  value={context.season}
                />
              </label>

              <div className="grid gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-primary-charcoal/50 dark:text-gray-400">Sport</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sportOptions.map((option) => {
                    const SportIcon = sportIcons[option.categoryId];
                    const isActive = option.categoryId === selectedCategory;
                    return (
                      <button
                        aria-pressed={isActive}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                          isActive
                            ? "border-primary-brown bg-primary-brown text-white shadow-[0_10px_22px_rgb(90,46,23,0.18)]"
                            : "border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100",
                        )}
                        disabled={!canEdit}
                        key={option.categoryId}
                        onClick={() => onCategorySelect(option.categoryId)}
                        type="button"
                      >
                        <SportIcon className="size-4 shrink-0" />
                        <span className="min-w-0 truncate">{option.sportLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid content-center gap-1 rounded-xl border border-secondary-sand/60 bg-primary-beige/35 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-charcoal/45 dark:text-gray-500">Metric</span>
                  <span className="truncate text-sm font-black text-primary-charcoal dark:text-gray-100">{selectedSportOption.metricLabel}</span>
                </div>
                <label className={fieldLabelClassName()}>
                  Total manual
                  <input
                    className={inputClassName("h-10")}
                    disabled={!canEdit}
                    inputMode={metricInputMode(draft.spec.metric)}
                    min="0"
                    onChange={(event) => onTotalOverrideChange(event.target.value)}
                    onWheel={(event) => event.currentTarget.blur()}
                    placeholder={"Auto: " + formatMetricValue(athleteTotal, draft.spec.metric)}
                    step={metricInputStep(draft.spec.metric)}
                    type="number"
                    value={draft.spec.totalOverride ?? ""}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ImportDataCard({
  canEdit,
  metric,
  pasteValue,
  onCsvUpload,
  onPasteImport,
  onPasteValueChange,
  onXlsxUpload,
}: {
  canEdit: boolean;
  metric: MetricType;
  pasteValue: string;
  onCsvUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onPasteImport: () => void;
  onPasteValueChange: (value: string) => void;
  onXlsxUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <section className="min-w-0 rounded-[1.35rem] border border-secondary-sand/60 bg-white p-5 shadow-[0_14px_34px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 border-b border-secondary-sand/50 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Input Mingguan</p>
          <h2 className="mt-1 font-poppins text-2xl font-black tracking-[-0.03em] text-primary-charcoal dark:text-gray-100">Import Data</h2>
        </div>
        <button className={buttonClassName("h-10 bg-primary-green text-white hover:bg-primary-green/90")} disabled={!canEdit} onClick={onPasteImport} type="button">
          <Upload className="size-4" />
          Import
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <label className={fieldLabelClassName()}>
          Paste CSV / JSON
          <textarea
            className={inputClassName("min-h-36 font-mono")}
            disabled={!canEdit}
            onChange={(event) => onPasteValueChange(event.target.value)}
            placeholder={importPlaceholder(metric)}
            value={pasteValue}
          />
        </label>
        <div className="grid content-end gap-2">
          <label
            className={cn(
              buttonClassName("h-11 cursor-pointer border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"),
              !canEdit && "pointer-events-none opacity-55",
            )}
          >
            <FileSpreadsheet className="size-4" />
            Upload CSV
            <input accept=".csv,text/csv" className="sr-only" onChange={onCsvUpload} type="file" />
          </label>
          <label
            className={cn(
              buttonClassName("h-11 cursor-pointer border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"),
              !canEdit && "pointer-events-none opacity-55",
            )}
          >
            <FileSpreadsheet className="size-4" />
            Upload XLSX
            <input accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={onXlsxUpload} type="file" />
          </label>
        </div>
      </div>
    </section>
  );
}

function AdminLeaderboardTable({
  actions,
  canEdit,
  changedCells,
  movementByAthleteKey,
  periodNavigation,
  unsavedChangeCount,
  onRequestDelete,
  onUpdate,
  spec,
}: {
  actions?: ReactNode;
  canEdit: boolean;
  changedCells: Set<string>;
  movementByAthleteKey: ReturnType<typeof buildLeaderboardStory>["movementByAthleteKey"];
  periodNavigation?: ReactNode;
  unsavedChangeCount: number;
  onRequestDelete: (athlete: PendingAthleteDelete) => void;
  onUpdate: (id: string, patch: Partial<AthleteEntry>) => void;
  spec: LeaderboardSpec;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const rankedAthletes = buildLeaderboardRows(spec.athletes, Math.max(10, spec.athletes.length));
  const rankedIds = new Set(rankedAthletes.map((athlete) => athlete.id));
  const athletes = [
    ...rankedAthletes,
    ...spec.athletes
      .filter((athlete) => !rankedIds.has(athlete.id))
      .map((athlete) => ({ ...athlete, rank: undefined })),
  ];

  function focusCell(id: string, field: EditableAthleteField) {
    window.requestAnimationFrame(() => {
      const input = inputRefs.current[athleteCellKey(id, field)];
      input?.focus();
      input?.select();
    });
  }

  function handleCellKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, field: EditableAthleteField) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const nextAthlete = athletes[rowIndex + 1];
    if (nextAthlete) {
      focusCell(nextAthlete.id, field);
    }
  }

  function inputStateClass(id: string, field: EditableAthleteField, extra?: string) {
    return inputClassName(
      cn(
        extra,
        changedCells.has(athleteCellKey(id, field)) &&
          "border-primary-green/70 bg-amber-50 shadow-[inset_0_0_0_1px_rgb(94,122,94,0.2)] dark:border-secondary-teal/70 dark:bg-amber-950/25",
      ),
    );
  }

  return (
    <section className="min-w-0 rounded-[1.35rem] border border-secondary-sand/60 bg-white p-5 shadow-[0_14px_34px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-secondary-sand/50 pb-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Klasemen Minggu Ini</p>
          <h3 className="mt-1 font-poppins text-2xl font-black tracking-[-0.03em] text-primary-charcoal dark:text-gray-100">Kelola Peringkat Atlet</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-bold text-primary-charcoal/58 dark:text-gray-400">
            <span>{compactDateRangeLabel(spec.dateRange)}</span>
            {periodNavigation}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
      </div>
      <div
        className={cn(
          "mt-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-black",
          unsavedChangeCount > 0
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
            : "border-primary-green/20 bg-primary-green/10 text-primary-green dark:border-secondary-teal/25 dark:bg-secondary-teal/10 dark:text-secondary-teal",
        )}
      >
        {unsavedChangeCount > 0 ? `● ${unsavedChangeCount} perubahan belum disimpan` : "✓ Semua perubahan tersimpan"}
      </div>
      {athletes.length ? (
      <div className="mt-4 overflow-hidden rounded-[1.1rem] border border-secondary-sand/60 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="max-h-[560px] w-full overflow-auto">
          <table className="w-full min-w-[1020px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[80px]" />
              <col className="w-[330px]" />
              <col className="w-[190px]" />
              <col className="w-[100px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-secondary-sand/50 bg-white text-xs font-bold uppercase tracking-[0.08em] text-primary-charcoal/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-500">
                <th className="whitespace-nowrap px-4 py-3 text-left">Rank</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Athlete</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Result</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">Move</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((athlete, rowIndex) => {
                const movement = movementByAthleteKey[athleteKey(athlete)];
                const moveLabel = !movement?.fromRank ? "—" : movement.delta > 0 ? `↑${movement.delta}` : movement.delta < 0 ? `↓${Math.abs(movement.delta)}` : "—";
                return (
                  <tr
                    className="border-b border-secondary-sand/35 bg-white last:border-b-0 dark:border-zinc-800 dark:bg-zinc-900"
                    data-leaderboard-athlete-key={athleteKey(athlete)}
                    key={athlete.id}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-poppins text-lg font-bold text-primary-brown dark:text-secondary-sand">
                      {athlete.rank ? `#${athlete.rank}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className={inputStateClass(athlete.id, "name", "h-10")}
                        disabled={!canEdit}
                        onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "name")}
                        onChange={(event) => onUpdate(athlete.id, { name: event.target.value, normalizedName: normalizeAthleteName(event.target.value) })}
                        placeholder="Nama atlet"
                        ref={(node) => {
                          inputRefs.current[athleteCellKey(athlete.id, "name")] = node;
                        }}
                        value={athlete.name}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className={inputStateClass(athlete.id, "value", "h-10 text-right font-bold text-primary-green dark:text-secondary-teal")}
                        disabled={!canEdit}
                        inputMode={metricInputMode(spec.metric)}
                        min="0"
                        onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "value")}
                        onChange={(event) => onUpdate(athlete.id, { value: normalizeMetricValue(event.target.value, spec.metric) })}
                        onWheel={(event) => event.currentTarget.blur()}
                        placeholder="0"
                        ref={(node) => {
                          inputRefs.current[athleteCellKey(athlete.id, "value")] = node;
                        }}
                        step={metricInputStep(spec.metric)}
                        type="number"
                        value={athlete.value}
                      />
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-center text-sm font-black", movement?.delta && movement.delta > 0 ? "text-primary-green dark:text-secondary-teal" : movement?.delta && movement.delta < 0 ? "text-secondary-clay dark:text-secondary-sand" : "text-primary-charcoal/40 dark:text-gray-500")}>
                      {moveLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Edit ${athlete.name || "athlete"}`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-bold text-primary-charcoal/65 transition hover:bg-secondary-sand/30 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300"
                          disabled={!canEdit}
                          onClick={() => focusCell(athlete.id, "name")}
                          type="button"
                        >
                          <Edit3 className="size-4" />
                          Edit
                        </button>
                      <button
                          aria-label={`Delete ${athlete.name || "athlete"}`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
                        disabled={!canEdit}
                          onClick={() => onRequestDelete({ id: athlete.id, name: athlete.name })}
                        type="button"
                      >
                        <Trash2 className="size-4" />
                          Delete
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="Belum ada data atlet" message="Import data atau tambahkan atlet manual untuk mulai membuat leaderboard." />
        </div>
      )}
    </section>
  );
}

export function LeaderboardAdminManager() {
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategoryId>(DEFAULT_LEADERBOARD_CATEGORY);
  const [draftsByCategory, setDraftsByCategory] = useState<Record<LeaderboardCategoryId, LeaderboardProjectState>>(createInitialCategoryDrafts);
  const [savedDraftsByCategory, setSavedDraftsByCategory] = useState<Record<LeaderboardCategoryId, LeaderboardProjectState>>(createInitialCategoryDrafts);
  const [snapshots, setSnapshots] = useState<LeaderboardWeekSnapshot[]>([]);
  const [pasteValue, setPasteValue] = useState("Utha,128.4\nAndi,120.1\nBudi,112.3");
  const [adminToken, setAdminToken] = useState("");
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");
  const [status, setStatus] = useState("Loading leaderboard");
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingPhotoAdjustment, setSavingPhotoAdjustment] = useState(false);
  const [exportPreviewSpec, setExportPreviewSpec] = useState<LeaderboardSpec | null>(null);
  const [exportAthleteSelection, setExportAthleteSelection] = useState<ExportAthleteSelection>("podiumTop10");
  const [exportPhotoAdjustments, setExportPhotoAdjustments] = useState<ExportPhotoAdjustments>({});
  const [deleteWeekOpen, setDeleteWeekOpen] = useState(false);
  const [deleteWeekConfirmed, setDeleteWeekConfirmed] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(false);
  const [pendingAthleteDelete, setPendingAthleteDelete] = useState<PendingAthleteDelete | null>(null);
  const [pendingViewChange, setPendingViewChange] = useState<PendingViewChange | null>(null);
  const [viewChangeSaving, setViewChangeSaving] = useState(false);
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");
  const [toast, setToast] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);
  const toastTimeoutRef = useRef<number | undefined>(undefined);

  const canEdit = isDevelopmentAdminToken(adminToken);
  const draft = draftsByCategory[selectedCategory];
  const savedDraft = savedDraftsByCategory[selectedCategory];
  const selectedCategoryConfig = categoryConfigForId(selectedCategory);
  const unsavedChangeCount = useMemo(() => countLeaderboardDraftChanges(draft, savedDraft), [draft, savedDraft]);
  const hasUnsavedChanges = unsavedChangeCount > 0;
  const changedCells = useMemo(() => changedAthleteCellKeys(draft.spec, savedDraft?.spec), [draft.spec, savedDraft?.spec]);
  const hasAnyUnsavedChanges = useMemo(
    () => LEADERBOARD_CATEGORIES.some((category) => countLeaderboardDraftChanges(draftsByCategory[category.id], savedDraftsByCategory[category.id]) > 0),
    [draftsByCategory, savedDraftsByCategory],
  );
  const athleteTotal = useMemo(() => sumMetricValues(draft.spec.athletes), [draft.spec.athletes]);
  const activeCategorySnapshots = useMemo(
    () => filterSnapshotsByCategory(snapshots, selectedCategory).sort(compareSnapshotsByWeekAsc),
    [selectedCategory, snapshots],
  );
  const currentDraftSnapshot = useMemo(() => currentSnapshotFromDraft(draft), [draft]);
  const visibleSnapshots = useMemo(
    () => upsertWeekSnapshot(activeCategorySnapshots, currentDraftSnapshot).sort(compareSnapshotsByWeekAsc),
    [activeCategorySnapshots, currentDraftSnapshot],
  );
  const exportSpec = useMemo(() => specWithTrend(draft.spec, visibleSnapshots), [draft.spec, visibleSnapshots]);
  const exportPreviewBaseSpec = exportPreviewSpec ?? exportSpec;
  const exportSelectionOptions = useMemo(() => exportAthleteSelectionOptions(exportPreviewBaseSpec), [exportPreviewBaseSpec]);
  const selectedExportSpec = useMemo(
    () => specWithExportAthleteSelection({ ...exportPreviewBaseSpec, exportPhotoAdjustments }, exportAthleteSelection),
    [exportAthleteSelection, exportPhotoAdjustments, exportPreviewBaseSpec],
  );
  const selectedSnapshot =
    visibleSnapshots.find((snapshot) => snapshotKey(snapshot) === selectedSnapshotKey) ?? visibleSnapshots[visibleSnapshots.length - 1];
  const story = useMemo(() => buildLeaderboardStory(selectedSnapshot, visibleSnapshots), [selectedSnapshot, visibleSnapshots]);
  const contextSummary = useMemo(() => getAdminLeaderboardContextSummary(draft), [draft]);

  useEffect(() => {
    if (exportSelectionOptions.length && !exportSelectionOptions.some((option) => option.value === exportAthleteSelection)) {
      setExportAthleteSelection(exportSelectionOptions[0].value);
    }
  }, [exportAthleteSelection, exportSelectionOptions]);

  async function saveCategorySnapshot(category: LeaderboardCategoryId, draftToSave: LeaderboardProjectState) {
    const token = adminToken.trim();
    const snapshot = currentSnapshotFromDraft(draftToSave);

    const [projectResponse, snapshotResponse] = await Promise.all([
      fetch("/api/leaderboard/projects/latest", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category, project: draftToSave }),
      }),
      fetch("/api/leaderboard/week-snapshots", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ snapshot }),
      }),
    ]);

    if (!projectResponse.ok || !snapshotResponse.ok) {
      const failed = !projectResponse.ok ? projectResponse : snapshotResponse;
      const payload = await failed.json().catch(() => null);
      const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : failed.statusText;
      throw new Error(message);
    }

    setSnapshots((current) => upsertWeekSnapshot(current, snapshot));
    setSavedDraftsByCategory((current) => ({ ...current, [category]: draftToSave }));
  }

  async function saveCategoryProject(category: LeaderboardCategoryId, draftToSave: LeaderboardProjectState) {
    const token = adminToken.trim();
    const response = await fetch("/api/leaderboard/projects/latest", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ category, project: draftToSave }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : response.statusText;
      throw new Error(message);
    }

    setSavedDraftsByCategory((current) => ({ ...current, [category]: draftToSave }));
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    setAdminTokenInput(savedToken);
    setAdminToken(isDevelopmentAdminToken(savedToken) ? savedToken : "");

    async function loadAdminData() {
      try {
        const [snapshotResponse, ...projectResponses] = await Promise.all([
          fetch("/api/leaderboard/week-snapshots", { headers: { Accept: "application/json" } }),
          ...LEADERBOARD_CATEGORIES.map((category) =>
            fetch(`/api/leaderboard/projects/latest?category=${category.id}`, { headers: { Accept: "application/json" } }),
          ),
        ]);

        const nextDrafts = createInitialCategoryDrafts();
        await Promise.all(
          projectResponses.map(async (response, index) => {
            if (!response.ok) {
              return;
            }

            const category = LEADERBOARD_CATEGORIES[index];
            const payload = (await response.json().catch(() => null)) as { project?: unknown } | null;
            const project = normalizeCategoryProjectState(payload?.project, category.id);
            if (project) {
              nextDrafts[category.id] = project;
            }
          }),
        );
        setDraftsByCategory(nextDrafts);
        setSavedDraftsByCategory(nextDrafts);

        if (snapshotResponse.ok) {
          const payload = (await snapshotResponse.json().catch(() => null)) as { snapshots?: unknown[] } | null;
          const parsed = (payload?.snapshots ?? [])
            .map((snapshot) => LeaderboardWeekSnapshotSchema.safeParse(snapshot))
            .filter((result): result is ReturnType<typeof LeaderboardWeekSnapshotSchema.safeParse> & { success: true } => result.success)
            .map((result) => result.data);
          setSnapshots(parsed);
        }

        setStatus(projectResponses.some((response) => response.ok) || snapshotResponse.ok ? "Ready" : "Database leaderboard belum siap.");
      } catch {
        setStatus("Database leaderboard belum bisa diakses.");
      }
    }

    void loadAdminData();
  }, []);

  useEffect(() => {
    if (adminToken) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  }, [adminToken]);

  useEffect(() => {
    setSelectedSnapshotKey((current) => {
      if (visibleSnapshots.some((snapshot) => snapshotKey(snapshot) === current)) {
        return current;
      }

      return visibleSnapshots.length ? snapshotKey(visibleSnapshots[visibleSnapshots.length - 1]) : "";
    });
  }, [visibleSnapshots]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    window.localStorage.setItem(UNSAVED_ADMIN_CHANGES_STORAGE_KEY, hasAnyUnsavedChanges ? "true" : "false");
  }, [hasAnyUnsavedChanges]);

  useEffect(() => {
    if (!hasAnyUnsavedChanges) {
      return;
    }

    const message = "Anda memiliki perubahan yang belum disimpan.";
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target || target.href === window.location.href) {
        return;
      }

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasAnyUnsavedChanges]);

  function showToast(tone: "success" | "error", title: string, message: string) {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ tone, title, message });
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3800);
  }

  async function handleSaveSnapshot(): Promise<boolean> {
    if (!canEdit) {
      setStatus("Enter admin token to save");
      showToast("error", "Token belum aktif", "Masukkan admin token sebelum menyimpan data leaderboard.");
      return false;
    }

    setSaving(true);
    setStatus("Saving snapshot...");
    try {
      await saveCategorySnapshot(selectedCategory, draft);
      setStatus("Snapshot saved to backend");
      showToast("success", "Perubahan berhasil disimpan", `${selectedCategoryConfig.label} ${compactDateRangeLabel(draft.spec.dateRange)} berhasil disimpan.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Save failed: ${message}`);
      showToast("error", "Gagal menyimpan", message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleAdminLogin() {
    const token = adminTokenInput.trim();
    if (isDevelopmentAdminToken(token)) {
      setAdminToken(token);
      setAdminLoginError("");
      setStatus("Admin access granted");
      return;
    }

    setAdminToken("");
    setAdminLoginError("Token admin tidak valid.");
    setStatus("Invalid admin token");
  }

  function handleDiscardChanges() {
    setDraftsByCategory((current) => ({ ...current, [selectedCategory]: savedDraft }));
    setStatus("Ready");
  }

  function openDeleteWeekDialog() {
    if (!canEdit) {
      return;
    }

    setDeleteWeekConfirmed(false);
    setDeleteWeekOpen(true);
  }

  function snapshotForView(target: PendingViewChange): LeaderboardWeekSnapshot | undefined {
    const templateId = templateIdForCategory(target.category);
    return snapshots
      .filter(
        (snapshot) =>
          snapshot.seasonYear === target.seasonYear &&
          snapshot.templateId === templateId &&
          weekIndexFromWeekNumber(snapshot.weekNumber) === weekIndexFromWeekNumber(target.weekNumber),
      )
      .sort((left, right) => new Date(right.exportedAt).getTime() - new Date(left.exportedAt).getTime())[0];
  }

  function draftForView(target: PendingViewChange): LeaderboardProjectState {
    const snapshot = snapshotForView(target);
    if (snapshot) {
      return createCategoryDraft(target.category, {
        seasonYear: snapshot.seasonYear,
        weekNumber: String(weekIndexFromWeekNumber(snapshot.weekNumber)),
        spec: snapshot.spec,
      });
    }

    const sourceDraft = draftsByCategory[target.category];
    return createCategoryDraft(target.category, {
      seasonYear: target.seasonYear,
      weekNumber: target.weekNumber,
      spec: {
        ...sourceDraft.spec,
        athletes: [],
        totalOverride: undefined,
        trendValues: [],
      },
    });
  }

  function performViewChange(target: PendingViewChange) {
    const nextDraft = draftForView(target);

    setSelectedCategory(target.category);
    setDraftsByCategory((current) => ({ ...current, [target.category]: nextDraft }));
    setSavedDraftsByCategory((current) => ({ ...current, [target.category]: nextDraft }));
    setSelectedSnapshotKey(snapshotKey(currentSnapshotFromDraft(nextDraft)));
    setStatus("Ready");
  }

  function requestViewChange(patch: Partial<PendingViewChange>) {
    const target: PendingViewChange = {
      category: patch.category ?? selectedCategory,
      seasonYear: patch.seasonYear ?? draft.seasonYear,
      weekNumber: patch.weekNumber ?? contextSummary.week,
    };

    if (
      target.category === selectedCategory &&
      target.seasonYear === draft.seasonYear &&
      weekIndexFromWeekNumber(target.weekNumber) === weekIndexFromWeekNumber(draft.weekNumber)
    ) {
      return;
    }

    if (hasUnsavedChanges) {
      setPendingViewChange(target);
      return;
    }

    performViewChange(target);
  }

  async function handleSavePendingViewChange() {
    if (!pendingViewChange) {
      return;
    }

    setViewChangeSaving(true);
    try {
      const saved = await handleSaveSnapshot();
      if (saved) {
        const target = pendingViewChange;
        setPendingViewChange(null);
        performViewChange(target);
      }
    } finally {
      setViewChangeSaving(false);
    }
  }

  function handleDiscardPendingViewChange() {
    if (!pendingViewChange) {
      return;
    }

    const target = pendingViewChange;
    setPendingViewChange(null);
    setDraftsByCategory((current) => ({ ...current, [selectedCategory]: savedDraft }));
    performViewChange(target);
  }

  async function handleConfirmDeleteWeek() {
    if (!canEdit || !deleteWeekConfirmed) {
      return;
    }

    const target: DeleteWeekTarget = getDeleteWeekTarget(draft);
    const clearedDraft = updateProjectDraft(draft, {
      spec: {
        ...draft.spec,
        athletes: [],
        totalOverride: undefined,
      },
    });

    setDeletingWeek(true);
    try {
      const response = await fetch("/api/leaderboard/week-snapshots", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(target),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : response.statusText;
        throw new Error(message);
      }

      await saveCategoryProject(selectedCategory, clearedDraft);
      setDraftsByCategory((current) => ({ ...current, [selectedCategory]: clearedDraft }));
      setSnapshots((current) =>
        current.filter(
          (snapshot) =>
            !(
              snapshot.seasonYear === target.seasonYear &&
              snapshot.weekNumber === target.weekNumber &&
              snapshot.templateId === target.templateId
            ),
        ),
      );
      setSelectedSnapshotKey("");
      setDeleteWeekOpen(false);
      setStatus("Data periode dihapus");
      showToast("success", "Data minggu dihapus", formatDeleteWeekSuccessMessage(target.dateRange, target.weekNumber));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Delete failed: ${message}`);
      showToast("error", "Gagal menghapus minggu", message);
    } finally {
      setDeletingWeek(false);
    }
  }

  function commitDraft(next: LeaderboardProjectState) {
    setDraftsByCategory((current) => ({ ...current, [selectedCategory]: next }));
    setStatus(canEdit ? "Unsaved changes" : "Enter admin token to save");
  }

  function updateSpec(patch: Partial<LeaderboardSpec>) {
    commitDraft(updateProjectDraft(draft, { spec: { ...draft.spec, ...patch } }));
  }

  function updateTotalOverride(value: string) {
    const trimmed = value.trim();
    updateSpec({
      totalOverride: trimmed ? normalizeMetricValue(trimmed, draft.spec.metric) : undefined,
    });
  }

  function updateAthlete(id: string, patch: Partial<AthleteEntry>) {
    updateSpec({
      athletes: draft.spec.athletes.map((athlete) => (athlete.id === id ? { ...athlete, ...patch } : athlete)),
    });
  }

  function deleteAthlete(id: string) {
    updateSpec({ athletes: draft.spec.athletes.filter((athlete) => athlete.id !== id) });
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

  function handleCategorySelect(category: LeaderboardCategoryId) {
    requestViewChange({
      category,
      seasonYear: draft.seasonYear,
      weekNumber: contextSummary.week,
    });
  }

  async function specWithLatestDatabasePhotos(spec: LeaderboardSpec) {
    const names = spec.athletes.map((athlete) => athlete.name).filter(Boolean);
    if (!names.length) {
      return spec;
    }

    const lookup = await lookupAthletesByName(names);
    const databaseAthletes = Array.from(lookup.values()).filter((athlete): athlete is AthleteRecord => Boolean(athlete));
    return specWithDatabaseAthletePhotos(spec, databaseAthletes);
  }

  function handleExportPhotoAdjustmentChange(layoutMode: ExportLayoutMode, athleteId: string, adjustment: ExportPhotoAdjustment) {
    const nextAdjustment = clampExportPhotoAdjustment(adjustment);

    setExportPhotoAdjustments((current) => ({
      ...current,
      [layoutMode]: {
        ...(current[layoutMode] ?? {}),
        [athleteId]: nextAdjustment,
      },
    }));
  }

  function handleExportPhotoAdjustmentReset(layoutMode: ExportLayoutMode, athleteId: string) {
    setExportPhotoAdjustments((current) => {
      const currentLayoutAdjustments = current[layoutMode];
      if (!currentLayoutAdjustments?.[athleteId]) {
        return current;
      }

      const nextLayoutAdjustments = { ...currentLayoutAdjustments };
      delete nextLayoutAdjustments[athleteId];
      const nextAdjustments = { ...current };

      if (Object.keys(nextLayoutAdjustments).length) {
        nextAdjustments[layoutMode] = nextLayoutAdjustments;
      } else {
        delete nextAdjustments[layoutMode];
      }

      return nextAdjustments;
    });
  }

  function clearExportPhotoAdjustmentOverrides(layoutMode: ExportLayoutMode, athleteIds: string[]) {
    if (!athleteIds.length) {
      return;
    }

    setExportPhotoAdjustments((current) => {
      const currentLayoutAdjustments = current[layoutMode];
      if (!currentLayoutAdjustments) {
        return current;
      }

      const nextLayoutAdjustments = { ...currentLayoutAdjustments };
      athleteIds.forEach((athleteId) => {
        delete nextLayoutAdjustments[athleteId];
      });

      const nextAdjustments = { ...current };
      if (Object.keys(nextLayoutAdjustments).length) {
        nextAdjustments[layoutMode] = nextLayoutAdjustments;
      } else {
        delete nextAdjustments[layoutMode];
      }

      return nextAdjustments;
    });
  }

  async function saveExportPhotoAdjustmentDefaults(layoutMode: ExportLayoutMode, targets: ExportPhotoAdjustmentSaveTarget[]) {
    if (!canEdit) {
      setStatus("Enter admin token to save photo preset");
      showToast("error", "Token belum aktif", "Masukkan admin token sebelum menyimpan preset foto.");
      return;
    }

    const saveableTargets = targets.filter((target): target is SaveableExportPhotoAdjustmentTarget => Boolean(target.athlete.athleteId));
    if (!saveableTargets.length) {
      setStatus("Athlete database record not linked");
      showToast("error", "Preset belum tersimpan", "Atlet ini belum tersambung ke database atlet.");
      return;
    }

    setSavingPhotoAdjustment(true);
    setStatus("Saving photo preset");
    try {
      const updatedAthletes = await Promise.all(
        saveableTargets.map(({ athlete, adjustment }) =>
          updateAthletePhotoAdjustments(athlete.athleteId, {
            ...(athlete.podiumPhotoAdjustments ?? {}),
            [layoutMode]: clampExportPhotoAdjustment(adjustment),
          }),
        ),
      );

      clearAthleteLookupCache();
      setExportPreviewSpec((current) => (current ? specWithDatabaseAthletePhotos(current, updatedAthletes) : current));
      clearExportPhotoAdjustmentOverrides(
        layoutMode,
        saveableTargets.map(({ athlete }) => athlete.id),
      );
      setStatus("Photo preset saved");
      showToast(
        "success",
        "Preset foto tersimpan",
        saveableTargets.length === 1
          ? `${saveableTargets[0].athlete.name} tersimpan untuk ${layoutMode === "podiumTop10" ? "Podium Top 10" : layoutMode.replace("top", "Top ")}.`
          : `${saveableTargets.length} preset foto tersimpan.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photo preset save failed";
      setStatus(message);
      showToast("error", "Gagal menyimpan preset", message);
    } finally {
      setSavingPhotoAdjustment(false);
    }
  }

  function handleSaveSelectedExportPhotoAdjustment(
    layoutMode: ExportLayoutMode,
    athlete: RankedAthlete,
    adjustment: ExportPhotoAdjustment,
  ) {
    void saveExportPhotoAdjustmentDefaults(layoutMode, [{ athlete, adjustment }]);
  }

  function handleSaveAdjustedExportPhotoAdjustments(layoutMode: ExportLayoutMode, athletes: RankedAthlete[]) {
    const layoutAdjustments = exportPhotoAdjustments[layoutMode] ?? {};
    const targets = athletes.flatMap((athlete) => {
      const adjustment = layoutAdjustments[athlete.id];
      return adjustment ? [{ athlete, adjustment }] : [];
    });

    void saveExportPhotoAdjustmentDefaults(layoutMode, targets);
  }

  async function openExportPreview() {
    const baseSpec = exportSpec;
    setExportAthleteSelection(exportAthleteSelectionOptions(baseSpec)[0]?.value ?? "top1");
    setExportPhotoAdjustments({});
    setExportPreviewSpec(baseSpec);
    setExportOpen(true);
    setStatus("Preparing export preview");

    try {
      setExportPreviewSpec(await specWithLatestDatabasePhotos(baseSpec));
      setStatus("Ready");
    } catch {
      setStatus("Ready");
    }
  }

  async function handleDownloadExport() {
    const baseSpec = exportPreviewBaseSpec;
    setExporting(true);
    setStatus("Rendering PNG");

    try {
      const latestPhotoSpec = await specWithLatestDatabasePhotos(baseSpec);
      const filename = await downloadLeaderboardPng(
        specWithExportAthleteSelection({ ...latestPhotoSpec, exportPhotoAdjustments }, exportAthleteSelection),
        STORY_FORMAT,
      );
      setExportPreviewSpec(latestPhotoSpec);
      setStatus("PNG downloaded");
      showToast("success", "Export berhasil", filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      setStatus(message);
      showToast("error", "Export gagal", message);
    } finally {
      setExporting(false);
    }
  }

  const tableActions = canEdit ? (
    <>
      <button
        className={buttonClassName("h-10 bg-primary-brown text-white shadow-[0_10px_24px_rgb(90,46,23,0.16)] hover:bg-primary-brown/90")}
        disabled={exporting || !draft.spec.athletes.length}
        onClick={() => void openExportPreview()}
        type="button"
      >
        <Download className="size-4" />
        Export
      </button>
      <button
        className={buttonClassName("h-10 bg-secondary-sand/70 text-primary-brown hover:bg-secondary-sand dark:bg-zinc-800 dark:text-secondary-sand")}
        onClick={() => updateSpec({ athletes: [...draft.spec.athletes, nextAthlete()] })}
        type="button"
      >
        <Plus className="size-4" />
        Add Athlete
      </button>
      <button
        className={buttonClassName("h-10 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200")}
        disabled={deletingWeek}
        onClick={openDeleteWeekDialog}
        type="button"
      >
        <Trash2 className="size-4" />
        Delete Week
      </button>
    </>
  ) : null;
  const pendingViewRange = pendingViewChange
    ? buildSeasonWeekCalendar(pendingViewChange.seasonYear, pendingViewChange.weekNumber).activeRange.compactDateRange
    : "";

  return (
    <div className="bg-primary-beige/55 pt-24 dark:bg-[#121212] md:pt-28">
      <section className="mx-auto grid min-w-0 w-full max-w-[1600px] gap-6 px-4 pb-20 sm:px-6 lg:px-8">
        <AdminContextBar
          adminLoginError={adminLoginError}
          adminTokenInput={adminTokenInput}
          athleteTotal={athleteTotal}
          canEdit={canEdit}
          context={contextSummary}
          draft={draft}
          selectedCategory={selectedCategory}
          status={status}
          onAdminLogin={handleAdminLogin}
          onAdminTokenInputChange={(value) => {
            setAdminTokenInput(value);
            setAdminLoginError("");
          }}
          onCategorySelect={handleCategorySelect}
          onViewChange={requestViewChange}
          onTotalOverrideChange={updateTotalOverride}
        />

        <ImportDataCard
          canEdit={canEdit}
          metric={draft.spec.metric}
          pasteValue={pasteValue}
          onCsvUpload={handleCsvUpload}
          onPasteImport={handlePasteImport}
          onPasteValueChange={setPasteValue}
          onXlsxUpload={handleXlsxUpload}
        />

        <AdminLeaderboardTable
          actions={tableActions}
          canEdit={canEdit}
          changedCells={changedCells}
          movementByAthleteKey={story.movementByAthleteKey}
          unsavedChangeCount={unsavedChangeCount}
          onRequestDelete={setPendingAthleteDelete}
          onUpdate={updateAthlete}
          spec={draft.spec}
        />

        {hasUnsavedChanges ? (
          <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-amber-200 bg-white/94 px-4 py-3 shadow-[0_-16px_44px_rgb(31,31,31,0.14)] backdrop-blur dark:border-amber-900/60 dark:bg-zinc-950/94">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-amber-700 dark:text-amber-200">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 dark:bg-amber-950">
                  <AlertTriangle className="size-4" />
                </span>
                <p className="text-sm font-black">{unsavedChangeCount} perubahan belum disimpan</p>
              </div>
              <div className="flex gap-2">
                <button
                  className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
                  disabled={saving}
                  onClick={handleDiscardChanges}
                  type="button"
                >
                  Discard Changes
                </button>
                <button
                  className={buttonClassName("h-10 bg-primary-brown text-white hover:bg-primary-brown/90")}
                  disabled={!canEdit || saving}
                  onClick={() => void handleSaveSnapshot()}
                  type="button"
                >
                  <Save className="size-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingViewChange ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Perubahan belum disimpan.</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-400">
                    Simpan atau buang perubahan sebelum pindah ke Season {pendingViewChange.seasonYear}, periode {pendingViewRange}.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <button
                  className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
                  disabled={viewChangeSaving}
                  onClick={() => setPendingViewChange(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={buttonClassName("h-10 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200")}
                  disabled={viewChangeSaving}
                  onClick={handleDiscardPendingViewChange}
                  type="button"
                >
                  Discard Changes
                </button>
                <button
                  className={buttonClassName("h-10 bg-primary-brown text-white hover:bg-primary-brown/90")}
                  disabled={!canEdit || viewChangeSaving || saving}
                  onClick={() => void handleSavePendingViewChange()}
                  type="button"
                >
                  <Save className="size-4" />
                  {viewChangeSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingAthleteDelete ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200">
                  <Trash2 className="size-5" />
                </span>
                <div>
                  <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Hapus atlet minggu ini?</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-400">
                    {pendingAthleteDelete.name || "Atlet ini"} akan dihapus dari draft minggu aktif. Klik Save Changes untuk menyimpan ke backend.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
                  onClick={() => setPendingAthleteDelete(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={buttonClassName("h-10 bg-red-600 text-white hover:bg-red-700")}
                  onClick={() => {
                    deleteAthlete(pendingAthleteDelete.id);
                    setPendingAthleteDelete(null);
                  }}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteWeekOpen ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Hapus seluruh data minggu ini?</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-400">
                    Semua data leaderboard pada periode yang sedang ditampilkan akan dihapus permanen.
                  </p>
                </div>
              </div>
              <label className="mt-5 flex items-start gap-3 rounded-xl border border-secondary-sand/70 bg-secondary-sand/20 p-3 text-sm font-bold text-primary-charcoal/75 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-gray-200">
                <input
                  checked={deleteWeekConfirmed}
                  className="mt-1 size-4 accent-primary-brown"
                  onChange={(event) => setDeleteWeekConfirmed(event.target.checked)}
                  type="checkbox"
                />
                Saya memahami data tidak dapat dikembalikan
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
                  disabled={deletingWeek}
                  onClick={() => setDeleteWeekOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={buttonClassName("h-10 bg-red-600 text-white hover:bg-red-700")}
                  disabled={!deleteWeekConfirmed || deletingWeek}
                  onClick={() => void handleConfirmDeleteWeek()}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  {deletingWeek ? "Deleting..." : "Delete Week"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <ExportPreviewModal
          exportAthleteSelection={exportAthleteSelection}
          exportAthleteSelectionOptions={exportSelectionOptions}
          exportPhotoAdjustments={exportPhotoAdjustments}
          exporting={exporting}
          savingPhotoAdjustment={savingPhotoAdjustment}
          onClose={() => setExportOpen(false)}
          onDownload={() => void handleDownloadExport()}
          onExportAthleteSelectionChange={setExportAthleteSelection}
          onExportPhotoAdjustmentChange={handleExportPhotoAdjustmentChange}
          onExportPhotoAdjustmentReset={handleExportPhotoAdjustmentReset}
          onSaveAdjustedPhotoAdjustments={handleSaveAdjustedExportPhotoAdjustments}
          onSaveSelectedPhotoAdjustment={handleSaveSelectedExportPhotoAdjustment}
          open={exportOpen}
          spec={selectedExportSpec}
        />

        {toast ? (
          <div
            aria-live="polite"
            className={cn(
              "fixed bottom-6 right-6 z-[90] w-[min(360px,calc(100vw-32px))] rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgb(31,31,31,0.18)] backdrop-blur",
              toast.tone === "success" && "border-primary-green/30 bg-primary-green text-white",
              toast.tone === "error" &&
                "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950 dark:text-red-100",
            )}
            role="status"
          >
            <div className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/18">
                <Save className="size-4" />
              </span>
              <div>
                <p className="text-sm font-black">{toast.title}</p>
                <p className="mt-0.5 text-sm font-semibold opacity-85">{toast.message}</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
