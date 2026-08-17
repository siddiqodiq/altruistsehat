"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
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
  categoryForSportMetric,
  categoryConfigForId,
  filterSnapshotsByCategory,
  leaderboardSportOptions,
  metricOptionsForSport,
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
  SportType,
} from "@/lib/leaderboard/types";
import {
  UNSAVED_ADMIN_CHANGES_STORAGE_KEY,
  athleteCellKey,
  changedAthleteCellKeys,
  countLeaderboardDraftChanges,
  formatDeleteWeekSuccessMessage,
  getAdminLeaderboardContextSummary,
  getDeleteWeekTarget,
  type EditableAthleteField,
} from "@/lib/leaderboard/admin-management";
import {
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
import { DEFAULT_EXPORT_PHOTO_ADJUSTMENTS } from "@/lib/leaderboard/photo-adjustments";
import {
  specWithLocalExportPhotoAdjustments,
  writeLocalExportPhotoAdjustment,
} from "@/lib/leaderboard/export-photo-autosave";
import {
  LeaderboardWeekSnapshotSchema,
  compareSnapshotsByWeekAsc,
  upsertWeekSnapshot,
  weekIndexFromWeekNumber,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";
import {
  buildSeasonMonthCalendar,
  buildSeasonWeekCalendar,
  deriveSeasonWeekRange,
  shiftMonthIso,
  type SeasonMonthCalendarWeekRow,
} from "@/lib/leaderboard/templates";
import {
  EmptyState,
  ExportPreviewModal,
  RankBadge,
  buttonClassName,
  fieldLabelClassName,
  inputClassName,
} from "./LeaderboardUi";
import { buildLeaderboardStory } from "@/lib/leaderboard/story";
import { cn } from "@/lib/utils";
import { useModalA11y } from "@/hooks/useModalA11y";

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

interface PendingExportPhotoAdjustmentAutosave {
  adjustment: ExportPhotoAdjustment;
  athlete: AthleteEntry;
  layoutMode: ExportLayoutMode;
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

function controlFieldClassName(className?: string) {
  return cn(inputClassName("h-11"), "flex items-center text-sm font-black normal-case tracking-normal", className);
}

function AdminControls({
  athleteTotal,
  canEdit,
  context,
  draft,
  selectedCategory,
  onCategorySelect,
  onViewChange,
  onTotalOverrideChange,
}: {
  athleteTotal: number;
  canEdit: boolean;
  context: ReturnType<typeof getAdminLeaderboardContextSummary>;
  draft: LeaderboardProjectState;
  selectedCategory: LeaderboardCategoryId;
  onCategorySelect: (category: LeaderboardCategoryId) => void;
  onViewChange: (patch: Partial<Pick<LeaderboardProjectState, "seasonYear" | "weekNumber">>) => void;
  onTotalOverrideChange: (value: string) => void;
}) {
  const sportOptions = useMemo(() => leaderboardSportOptions(), []);
  const selectedCategoryConfig = categoryConfigForId(selectedCategory);
  const selectedSportOption = sportOptions.find((option) => option.sportType === selectedCategoryConfig.sportType) ?? {
    defaultCategoryId: selectedCategory,
    shortLabel: selectedCategoryConfig.shortLabel,
    sportLabel: selectedCategoryConfig.label,
    sportType: selectedCategoryConfig.sportType,
  };
  const metricOptions = useMemo(() => metricOptionsForSport(selectedSportOption.sportType), [selectedSportOption.sportType]);
  const selectedMetricOption = metricOptions.find((option) => option.categoryId === selectedCategory) ?? metricOptions[0];
  const activeCalendar = useMemo(() => buildSeasonMonthCalendar(context.season, context.week), [context.season, context.week]);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);

  return (
    <section
      aria-label="Pengaturan leaderboard aktif"
      className="min-w-0 rounded-[1.15rem] border border-secondary-sand/70 bg-white/95 p-4 shadow-[0_14px_34px_rgb(90,46,23,0.08)] dark:border-zinc-800 dark:bg-zinc-900/95"
    >
      <div className="flex flex-col gap-2 border-b border-secondary-sand/50 pb-3 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Pengaturan Mingguan</p>
          <h2 className="mt-1 font-poppins text-xl font-black tracking-normal text-primary-charcoal dark:text-gray-100">
            {activeCalendar.activeRange.compactDateRange}
          </h2>
        </div>
        <p className="text-sm font-black text-primary-charcoal/55 dark:text-gray-400">
          Musim {context.season} · {selectedSportOption.sportLabel} · {selectedMetricOption?.metricLabel ?? context.metric}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(110px,0.58fr)_minmax(180px,0.75fr)_minmax(150px,0.68fr)_minmax(150px,0.68fr)]">
        <label className={fieldLabelClassName()}>
          Periode
          <button
            className={controlFieldClassName("cursor-pointer justify-between gap-3 text-left hover:border-primary-green hover:ring-4 hover:ring-primary-green/10")}
            disabled={!canEdit}
            onClick={() => setWeekPickerOpen(true)}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <CalendarDays className="size-4 shrink-0 text-primary-green dark:text-secondary-teal" />
              <span className="truncate">{activeCalendar.activeRange.compactDateRange}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-primary-charcoal/45 dark:text-gray-500" />
          </button>
        </label>

        <label className={fieldLabelClassName()}>
          Musim
          <input
            className={controlFieldClassName()}
            disabled={!canEdit}
            min="1"
            onChange={(event) => onViewChange({ seasonYear: event.target.value })}
            type="number"
            value={context.season}
          />
        </label>

        <label className={fieldLabelClassName()}>
          Pilih olahraga
          <select
            className={controlFieldClassName("appearance-none pr-9")}
            disabled={!canEdit}
            onChange={(event) => onCategorySelect(categoryForSportMetric(event.target.value as SportType, selectedCategoryConfig.metric))}
            value={selectedSportOption.sportType}
          >
            {sportOptions.map((option) => (
              <option key={option.sportType} value={option.sportType}>
                {option.sportLabel}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName()}>
          Ukuran
          <select
            aria-label="Pilih ukuran"
            className={controlFieldClassName("appearance-none pr-9")}
            disabled={!canEdit || metricOptions.length < 2}
            onChange={(event) => onCategorySelect(event.target.value as LeaderboardCategoryId)}
            value={selectedMetricOption?.categoryId ?? selectedCategory}
          >
            {metricOptions.map((option) => (
              <option key={option.categoryId} value={option.categoryId}>
                {option.metricLabel}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldLabelClassName()}>
          Total komunitas
          <input
            className={controlFieldClassName()}
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

      <WeekPickerModal
        canEdit={canEdit}
        onClose={() => setWeekPickerOpen(false)}
        onConfirm={(weekValue) => {
          onViewChange({ weekNumber: weekValue });
          setWeekPickerOpen(false);
        }}
        open={weekPickerOpen}
        seasonYear={context.season}
        selectedWeekValue={context.week}
      />
    </section>
  );
}

function WeekPickerModal({
  canEdit,
  onClose,
  onConfirm,
  open,
  seasonYear,
  selectedWeekValue,
}: {
  canEdit: boolean;
  onClose: () => void;
  onConfirm: (weekValue: string) => void;
  open: boolean;
  seasonYear: string;
  selectedWeekValue: string;
}) {
  const activeCalendar = useMemo(() => buildSeasonMonthCalendar(seasonYear, selectedWeekValue), [seasonYear, selectedWeekValue]);
  const [calendarMonthIso, setCalendarMonthIso] = useState(activeCalendar.monthStartIso);
  const [hoveredWeekValue, setHoveredWeekValue] = useState<string | null>(null);
  const [pendingWeekValue, setPendingWeekValue] = useState(selectedWeekValue);
  const calendar = useMemo(
    () => buildSeasonMonthCalendar(seasonYear, pendingWeekValue, calendarMonthIso),
    [calendarMonthIso, pendingWeekValue, seasonYear],
  );
  const highlightedWeekValue = hoveredWeekValue ?? pendingWeekValue;
  const selectedRange = useMemo(() => deriveSeasonWeekRange(seasonYear, pendingWeekValue), [pendingWeekValue, seasonYear]);
  const weekdayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  useEffect(() => {
    if (!open) {
      return;
    }

    setCalendarMonthIso(activeCalendar.monthStartIso);
    setHoveredWeekValue(null);
    setPendingWeekValue(selectedWeekValue);
  }, [activeCalendar.monthStartIso, open, selectedWeekValue]);

  return (
    <Modal className="max-w-md" label="Pilih minggu" onClose={onClose} open={open}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-poppins text-xl font-black tracking-normal text-primary-charcoal dark:text-gray-100">Pilih minggu</h2>
          <p className="mt-1 text-sm font-black text-primary-charcoal/55 dark:text-gray-400">{selectedRange.compactDateRange}</p>
        </div>
        <button
          aria-label="Tutup picker minggu"
          className="grid size-9 shrink-0 place-items-center rounded-full text-primary-charcoal/55 transition hover:bg-secondary-sand/35 hover:text-primary-brown dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-secondary-sand"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <button
            aria-label="Bulan sebelumnya"
            className="grid size-9 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal/70 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
            onClick={() => setCalendarMonthIso((value) => shiftMonthIso(value, -1))}
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="font-poppins text-base font-black text-primary-charcoal dark:text-gray-100">{calendar.monthLabel}</p>
          <button
            aria-label="Bulan berikutnya"
            className="grid size-9 place-items-center rounded-full border border-secondary-sand bg-white text-primary-charcoal/70 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
            onClick={() => setCalendarMonthIso((value) => shiftMonthIso(value, 1))}
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 px-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary-charcoal/45 dark:text-gray-500">
          {weekdayLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-2 space-y-1.5" onMouseLeave={() => setHoveredWeekValue(null)}>
          {calendar.weekRows.map((week) => {
            return (
              <WeekRow
                canEdit={canEdit}
                highlighted={week.weekValue === highlightedWeekValue}
                key={week.days[0]?.dateIso ?? week.weekValue}
                onPreview={setHoveredWeekValue}
                onSelect={setPendingWeekValue}
                selected={week.weekValue === pendingWeekValue}
                week={week}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-secondary-sand/50 pt-4 dark:border-zinc-800">
        <p className="font-poppins text-base font-black text-primary-charcoal dark:text-gray-100">Minggu, {selectedRange.compactDateRange}</p>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
          onClick={onClose}
          type="button"
        >
          Batal
        </button>
        <button
          className={buttonClassName("h-10 bg-primary-brown text-white hover:bg-primary-brown/90")}
          disabled={!canEdit}
          onClick={() => onConfirm(pendingWeekValue)}
          type="button"
        >
          Terapkan
        </button>
      </div>
    </Modal>
  );
}

function WeekRow({
  canEdit,
  highlighted,
  onPreview,
  onSelect,
  selected,
  week,
}: {
  canEdit: boolean;
  highlighted: boolean;
  onPreview: (weekValue: string | null) => void;
  onSelect: (weekValue: string) => void;
  selected: boolean;
  week: SeasonMonthCalendarWeekRow;
}) {
  return (
    <button
      aria-label={`Pilih minggu ${week.compactWeekRange}`}
      aria-pressed={selected}
      className={cn(
        "grid min-h-10 w-full grid-cols-7 rounded-xl border px-2 text-center text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-green/15 disabled:cursor-not-allowed disabled:opacity-55 dark:focus-visible:ring-secondary-teal/20",
        highlighted
          ? "border-primary-green/35 bg-primary-green/10 dark:border-secondary-teal/45 dark:bg-secondary-teal/10"
          : "border-transparent hover:border-primary-green/25 hover:bg-primary-green/5 dark:hover:border-secondary-teal/35 dark:hover:bg-secondary-teal/10",
        selected && "border-primary-brown bg-primary-brown/10 shadow-[0_10px_22px_rgb(90,46,23,0.10)] dark:border-secondary-sand/55 dark:bg-secondary-sand/10",
      )}
      disabled={!canEdit}
      onBlur={() => onPreview(null)}
      onClick={() => onSelect(week.weekValue)}
      onFocus={() => onPreview(week.weekValue)}
      onMouseEnter={() => onPreview(week.weekValue)}
      type="button"
    >
      {week.days.map((day) => (
        <span
          className={cn(
            "grid min-h-10 place-items-center",
            day.inMonth ? "text-primary-charcoal dark:text-gray-100" : "text-primary-charcoal/35 dark:text-gray-600",
          )}
          key={day.dateIso}
        >
          {day.dayOfMonth}
        </span>
      ))}
    </button>
  );
}

function ImportDataModal({
  canEdit,
  metric,
  onClose,
  pasteValue,
  open,
  onCsvUpload,
  onPasteImport,
  onPasteValueChange,
  onXlsxUpload,
}: {
  canEdit: boolean;
  metric: MetricType;
  onClose: () => void;
  pasteValue: string;
  open: boolean;
  onCsvUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onPasteImport: () => void;
  onPasteValueChange: (value: string) => void;
  onXlsxUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Modal className="max-w-3xl" label="Masukkan data" onClose={onClose} open={open}>
      <div className="flex flex-col gap-3 border-b border-secondary-sand/50 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Input Mingguan</p>
          <h2 className="mt-1 font-poppins text-2xl font-black tracking-[-0.03em] text-primary-charcoal dark:text-gray-100">Masukkan data</h2>
        </div>
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
            Unggah CSV
            <input accept=".csv,text/csv" className="sr-only" onChange={onCsvUpload} type="file" />
          </label>
          <label
            className={cn(
              buttonClassName("h-11 cursor-pointer border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"),
              !canEdit && "pointer-events-none opacity-55",
            )}
          >
            <FileSpreadsheet className="size-4" />
            Unggah XLSX
            <input accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={onXlsxUpload} type="file" />
          </label>
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
          onClick={onClose}
          type="button"
        >
          Batal
        </button>
        <button className={buttonClassName("h-10 bg-primary-green text-white hover:bg-primary-green/90")} disabled={!canEdit} onClick={onPasteImport} type="button">
          <Upload className="size-4" />
          Masukkan data
        </button>
      </div>
    </Modal>
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
          "border-l-[3px] border-l-amber-400 bg-amber-50/40 dark:border-l-amber-500 dark:bg-amber-950/15",
      ),
    );
  }

  return (
    <section className="min-w-0 rounded-[1.35rem] border border-secondary-sand/60 bg-white p-5 shadow-[0_14px_34px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-secondary-sand/50 pb-4 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-green dark:text-secondary-teal">Klasemen Minggu Ini</p>
          <h3 className="mt-1 font-poppins text-2xl font-black tracking-[-0.03em] text-primary-charcoal dark:text-gray-100">Leaderboard</h3>
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
                <th className="sticky left-0 z-30 whitespace-nowrap bg-inherit px-4 py-3 text-left">Peringkat</th>
                <th className="sticky left-[80px] z-30 whitespace-nowrap bg-inherit px-4 py-3 text-left">Anggota</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Hasil</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">Naik-turun</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Aksi</th>
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
                    <td className="sticky left-0 z-20 whitespace-nowrap bg-inherit px-4 py-3">
                      <RankBadge rank={athlete.rank} size="sm" />
                    </td>
                    <td className="sticky left-[80px] z-20 bg-inherit px-4 py-3">
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
                    <td className={cn("whitespace-nowrap px-4 py-3 text-center text-sm font-black", movement?.delta && movement.delta > 0 ? "text-primary-green dark:text-secondary-teal" : movement?.delta && movement.delta < 0 ? "text-secondary-clay dark:text-secondary-sand" : "text-primary-charcoal/65 dark:text-gray-400")}>
                      {moveLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          aria-label={`Edit ${athlete.name || "anggota"}`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-secondary-sand bg-white px-3 text-sm font-bold text-primary-charcoal/65 transition hover:bg-secondary-sand/30 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300"
                          disabled={!canEdit}
                          onClick={() => focusCell(athlete.id, "name")}
                          type="button"
                        >
                          <Edit3 className="size-4" />
                          Edit
                        </button>
                      <button
                          aria-label={`Hapus ${athlete.name || "anggota"}`}
                          className="inline-flex size-10 items-center justify-center rounded-xl border border-transparent text-red-500/75 transition hover:border-secondary-sand hover:bg-secondary-sand/25 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                        disabled={!canEdit}
                          onClick={() => onRequestDelete({ id: athlete.id, name: athlete.name })}
                        title="Hapus"
                        type="button"
                      >
                        <Trash2 className="size-4" />
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
          <EmptyState title="Belum ada data atlet" message="Masukkan data atau tambahkan anggota manual untuk mulai membuat leaderboard." />
        </div>
      )}
    </section>
  );
}

export function LeaderboardAdminManager({ topbarClearance = false }: { topbarClearance?: boolean } = {}) {
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategoryId>(DEFAULT_LEADERBOARD_CATEGORY);
  const [draftsByCategory, setDraftsByCategory] = useState<Record<LeaderboardCategoryId, LeaderboardProjectState>>(createInitialCategoryDrafts);
  const [savedDraftsByCategory, setSavedDraftsByCategory] = useState<Record<LeaderboardCategoryId, LeaderboardProjectState>>(createInitialCategoryDrafts);
  const [snapshots, setSnapshots] = useState<LeaderboardWeekSnapshot[]>([]);
  const [pasteValue, setPasteValue] = useState("Utha,128.4\nAndi,120.1\nBudi,112.3");
  const [, setStatus] = useState("Memuat leaderboard");
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshingExportPreview, setRefreshingExportPreview] = useState(false);
  const [exportPreviewSpec, setExportPreviewSpec] = useState<LeaderboardSpec | null>(null);
  const [exportAthleteSelection, setExportAthleteSelection] = useState<ExportAthleteSelection>("podiumTop10");
  const [exportPhotoAdjustments, setExportPhotoAdjustments] = useState<ExportPhotoAdjustments>({});
  const [deleteWeekOpen, setDeleteWeekOpen] = useState(false);
  const [deleteWeekConfirmed, setDeleteWeekConfirmed] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(false);
  const [pendingAthleteDelete, setPendingAthleteDelete] = useState<PendingAthleteDelete | null>(null);
  const [pendingViewChange, setPendingViewChange] = useState<PendingViewChange | null>(null);
  const [viewChangeSaving, setViewChangeSaving] = useState(false);
  const pendingViewChangeDialogRef = useModalA11y<HTMLDivElement>(Boolean(pendingViewChange), () => setPendingViewChange(null));
  const pendingAthleteDeleteDialogRef = useModalA11y<HTMLDivElement>(Boolean(pendingAthleteDelete), () => setPendingAthleteDelete(null));
  const deleteWeekDialogRef = useModalA11y<HTMLDivElement>(deleteWeekOpen, () => setDeleteWeekOpen(false));
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");
  const [toast, setToast] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);
  const toastTimeoutRef = useRef<number | undefined>(undefined);
  const exportPhotoAutosaveTimersRef = useRef<Record<string, number>>({});
  const pendingExportPhotoAutosavesRef = useRef<Record<string, PendingExportPhotoAdjustmentAutosave>>({});
  const activeExportPhotoAutosavesRef = useRef<Promise<void>[]>([]);

  const canEdit = true;
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
    const snapshot = currentSnapshotFromDraft(draftToSave);

    const [projectResponse, snapshotResponse] = await Promise.all([
      fetch("/api/leaderboard/projects/latest", {
        credentials: "same-origin",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category, project: draftToSave }),
      }),
      fetch("/api/leaderboard/week-snapshots", {
        credentials: "same-origin",
        method: "POST",
        headers: {
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
    const response = await fetch("/api/leaderboard/projects/latest", {
      credentials: "same-origin",
      method: "PUT",
      headers: {
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
    async function loadAdminData() {
      try {
        const [snapshotResponse, ...projectResponses] = await Promise.all([
          fetch("/api/leaderboard/week-snapshots", { credentials: "same-origin", headers: { Accept: "application/json" } }),
          ...LEADERBOARD_CATEGORIES.map((category) =>
            fetch(`/api/leaderboard/projects/latest?category=${category.id}`, { credentials: "same-origin", headers: { Accept: "application/json" } }),
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

        setStatus(projectResponses.some((response) => response.ok) || snapshotResponse.ok ? "Siap" : "Leaderboard belum siap dibuka.");
      } catch {
        setStatus("Leaderboard belum bisa dimuat.");
      }
    }

    void loadAdminData();
  }, []);

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

      Object.values(exportPhotoAutosaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
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
      setStatus("Akses belum tersedia");
      showToast("error", "Akses admin diperlukan", "Silakan login sebagai admin sebelum menyimpan data leaderboard.");
      return false;
    }

    setSaving(true);
    setStatus("Menyimpan perubahan...");
    try {
      await saveCategorySnapshot(selectedCategory, draft);
      setStatus("Perubahan tersimpan");
      showToast("success", "Perubahan berhasil disimpan", `${selectedCategoryConfig.label} ${compactDateRangeLabel(draft.spec.dateRange)} berhasil disimpan.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Perubahan belum bisa disimpan. Coba lagi sebentar.";
      setStatus("Perubahan belum tersimpan");
      showToast("error", "Gagal menyimpan", message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardChanges() {
    setDraftsByCategory((current) => ({ ...current, [selectedCategory]: savedDraft }));
    setStatus("Siap");
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
    setStatus("Siap");
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
        credentials: "same-origin",
        method: "DELETE",
        headers: {
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
      const message = error instanceof Error ? error.message : "Data minggu belum bisa dibersihkan. Coba lagi sebentar.";
      setStatus("Data minggu belum bisa dibersihkan");
      showToast("error", "Gagal menghapus minggu", message);
    } finally {
      setDeletingWeek(false);
    }
  }

  function commitDraft(next: LeaderboardProjectState) {
    setDraftsByCategory((current) => ({ ...current, [selectedCategory]: next }));
    setStatus(canEdit ? "Ada perubahan belum disimpan" : "Akses belum tersedia");
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

  async function replaceAthletes(athletes: AthleteEntry[]): Promise<number> {
    const enriched = await enrichImportedAthletes(athletes);
    updateSpec({ athletes: enriched.length ? enriched : draft.spec.athletes });
    setStatus(`${enriched.length} atlet masuk ke draft minggu ini`);
    return enriched.length;
  }

  async function handlePasteImport() {
    if (!canEdit) {
      return;
    }

    try {
      const trimmed = pasteValue.trim();
      if (!trimmed) {
        throw new Error("Tempel data leaderboard dulu.");
      }

      const athletes = trimmed.startsWith("[") || trimmed.startsWith("{")
        ? parseJsonInput(trimmed, draft.spec.metric)
        : parseCsvInput(trimmed, draft.spec.metric);
      const imported = await replaceAthletes(athletes);
      setImportOpen(false);
      showToast("success", "Data masuk", `${imported} atlet masuk ke draft minggu ini.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data belum bisa dimasukkan. Coba lagi sebentar.";
      setStatus("Data belum bisa dimasukkan");
      showToast("error", "Data belum masuk", message);
    }
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canEdit) {
      return;
    }

    try {
      const imported = await replaceAthletes(parseCsvInput(await file.text(), draft.spec.metric));
      setImportOpen(false);
      showToast("success", "CSV berhasil diimport", `${imported} atlet masuk ke draft minggu ini.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV belum bisa dibaca. Periksa file lalu coba lagi.";
      setStatus("CSV belum bisa dibaca");
      showToast("error", "CSV gagal", message);
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
      const imported = await replaceAthletes(parseSpreadsheetRows(rows, draft.spec.metric));
      setImportOpen(false);
      showToast("success", "XLSX berhasil diimport", `${imported} atlet masuk ke draft minggu ini.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "XLSX belum bisa dibaca. Periksa file lalu coba lagi.";
      setStatus("XLSX belum bisa dibaca");
      showToast("error", "XLSX gagal", message);
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
      return specWithLocalExportPhotoAdjustments(spec);
    }

    clearAthleteLookupCache();
    const lookup = await lookupAthletesByName(names, { forceRefresh: true });
    const databaseAthletes = Array.from(lookup.values()).filter((athlete): athlete is AthleteRecord => Boolean(athlete));
    return specWithLocalExportPhotoAdjustments(specWithDatabaseAthletePhotos(spec, databaseAthletes));
  }

  function exportPhotoAutosaveKey(layoutMode: ExportLayoutMode, athleteId: string) {
    return `${layoutMode}:${athleteId}`;
  }

  async function persistExportPhotoAdjustmentAutosave(target: PendingExportPhotoAdjustmentAutosave) {
    const adjustment = clampExportPhotoAdjustment(target.adjustment);

    if (!target.athlete.athleteId) {
      writeLocalExportPhotoAdjustment({ adjustment, athlete: target.athlete, layoutMode: target.layoutMode });
      setExportPreviewSpec((current) => (current ? specWithLocalExportPhotoAdjustments(current) : current));
      return;
    }

    try {
      const updatedAthlete = await updateAthletePhotoAdjustments(target.athlete.athleteId, {
        ...(target.athlete.podiumPhotoAdjustments ?? {}),
        [target.layoutMode]: adjustment,
      });

      clearAthleteLookupCache();
      setExportPreviewSpec((current) =>
        current ? specWithLocalExportPhotoAdjustments(specWithDatabaseAthletePhotos(current, [updatedAthlete])) : current,
      );
      setStatus("Posisi foto tersimpan");
    } catch {
      writeLocalExportPhotoAdjustment({ adjustment, athlete: target.athlete, layoutMode: target.layoutMode });
      setExportPreviewSpec((current) => (current ? specWithLocalExportPhotoAdjustments(current) : current));
      setStatus("Posisi foto tersimpan di perangkat ini");
    }
  }

  function trackActiveExportPhotoAutosave(promise: Promise<void>) {
    activeExportPhotoAutosavesRef.current.push(promise);
    promise.finally(() => {
      activeExportPhotoAutosavesRef.current = activeExportPhotoAutosavesRef.current.filter((candidate) => candidate !== promise);
    });
  }

  function scheduleExportPhotoAdjustmentAutosave(target: PendingExportPhotoAdjustmentAutosave) {
    const key = exportPhotoAutosaveKey(target.layoutMode, target.athlete.id);
    pendingExportPhotoAutosavesRef.current[key] = target;

    const currentTimer = exportPhotoAutosaveTimersRef.current[key];
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }

    exportPhotoAutosaveTimersRef.current[key] = window.setTimeout(() => {
      delete exportPhotoAutosaveTimersRef.current[key];
      const pending = pendingExportPhotoAutosavesRef.current[key];
      delete pendingExportPhotoAutosavesRef.current[key];
      if (pending) {
        trackActiveExportPhotoAutosave(persistExportPhotoAdjustmentAutosave(pending));
      }
    }, 650);
  }

  async function flushPendingExportPhotoAdjustmentAutosaves() {
    const pendingTargets = Object.entries(pendingExportPhotoAutosavesRef.current).map(([key, target]) => {
      const timer = exportPhotoAutosaveTimersRef.current[key];
      if (timer) {
        window.clearTimeout(timer);
        delete exportPhotoAutosaveTimersRef.current[key];
      }

      return target;
    });

    pendingExportPhotoAutosavesRef.current = {};
    const flushes = pendingTargets.map((target) => persistExportPhotoAdjustmentAutosave(target));
    await Promise.allSettled([...activeExportPhotoAutosavesRef.current, ...flushes]);
  }

  function handleExportPhotoAdjustmentChange(layoutMode: ExportLayoutMode, athleteId: string, adjustment: ExportPhotoAdjustment) {
    const nextAdjustment = clampExportPhotoAdjustment(adjustment);
    const targetAthlete = selectedExportSpec.athletes.find((athlete) => athlete.id === athleteId);

    setExportPhotoAdjustments((current) => ({
      ...current,
      [layoutMode]: {
        ...(current[layoutMode] ?? {}),
        [athleteId]: nextAdjustment,
      },
    }));

    if (targetAthlete) {
      writeLocalExportPhotoAdjustment({ adjustment: nextAdjustment, athlete: targetAthlete, layoutMode });
      scheduleExportPhotoAdjustmentAutosave({
        adjustment: nextAdjustment,
        athlete: targetAthlete,
        layoutMode,
      });
    }
  }

  function handleExportPhotoAdjustmentReset(layoutMode: ExportLayoutMode, athleteId: string) {
    handleExportPhotoAdjustmentChange(layoutMode, athleteId, DEFAULT_EXPORT_PHOTO_ADJUSTMENTS[layoutMode]);
  }


  async function openExportPreview() {
    const baseSpec = specWithLocalExportPhotoAdjustments(exportSpec);
    setExportAthleteSelection(exportAthleteSelectionOptions(baseSpec)[0]?.value ?? "top1");
    setExportPreviewSpec(baseSpec);
    setExportOpen(true);
    setRefreshingExportPreview(true);
    setStatus("Menyiapkan pratinjau gambar");

    try {
      setExportPreviewSpec(await specWithLatestDatabasePhotos(baseSpec));
      setStatus("Siap");
    } catch {
      setStatus("Siap");
    } finally {
      setRefreshingExportPreview(false);
    }
  }

  async function handleRefreshExportPreview() {
    if (refreshingExportPreview) {
      return;
    }

    setRefreshingExportPreview(true);
    setStatus("Memperbarui pratinjau gambar");

    try {
      setExportPreviewSpec(await specWithLatestDatabasePhotos(exportSpec));
      setStatus("Pratinjau gambar diperbarui");
      showToast("success", "Pratinjau diperbarui", "Foto atlet sudah dimuat ulang.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pratinjau belum bisa diperbarui. Coba lagi sebentar.";
      setStatus(message);
      showToast("error", "Pratinjau belum diperbarui", message);
    } finally {
      setRefreshingExportPreview(false);
    }
  }

  async function handleDownloadExport() {
    setExporting(true);
    setStatus("Menyiapkan PNG");

    try {
      await flushPendingExportPhotoAdjustmentAutosaves();
      const exportSpecToDownload = await specWithLatestDatabasePhotos(selectedExportSpec);
      const filename = await downloadLeaderboardPng(exportSpecToDownload, STORY_FORMAT);
      setStatus("PNG berhasil diunduh");
      showToast("success", "Gambar berhasil diunduh", filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : "PNG belum bisa diunduh. Coba lagi sebentar.";
      setStatus(message);
      showToast("error", "Unduh gambar gagal", message);
    } finally {
      setExporting(false);
    }
  }

  const tableActions = canEdit ? (
    <>
      <button
        className={buttonClassName("h-9 rounded-lg px-3 bg-primary-green text-white shadow-[0_10px_22px_rgb(94,122,94,0.14)] hover:bg-primary-green/90")}
        onClick={() => setImportOpen(true)}
        type="button"
      >
        <Upload className="size-4" />
        Masukkan data
      </button>
      <button
        className={buttonClassName("h-9 rounded-lg px-3 bg-primary-brown text-white shadow-[0_10px_22px_rgb(90,46,23,0.14)] hover:bg-primary-brown/90")}
        disabled={exporting || !draft.spec.athletes.length}
        onClick={() => void openExportPreview()}
        type="button"
      >
        <Download className="size-4" />
        Unduh gambar
      </button>
      <button
        className={buttonClassName("h-9 rounded-lg px-3 bg-secondary-sand/70 text-primary-brown hover:bg-secondary-sand dark:bg-zinc-800 dark:text-secondary-sand")}
        onClick={() => updateSpec({ athletes: [...draft.spec.athletes, nextAthlete()] })}
        type="button"
      >
        <Plus className="size-4" />
        Tambah anggota
      </button>
      <button
        className={buttonClassName("h-9 rounded-lg px-3 border border-secondary-sand bg-white text-red-600 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-zinc-800")}
        disabled={deletingWeek}
        onClick={openDeleteWeekDialog}
        type="button"
      >
        <Trash2 className="size-4" />
        Bersihkan minggu
      </button>
    </>
  ) : null;
  const pendingViewRange = pendingViewChange
    ? buildSeasonWeekCalendar(pendingViewChange.seasonYear, pendingViewChange.weekNumber).activeRange.compactDateRange
    : "";

  return (
    <div className={cn("bg-primary-beige/55 dark:bg-[#121212]", topbarClearance && "topbar-clearance")}>
      <section className="grid min-w-0 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 gap-6 pb-20">
        <AdminControls
          athleteTotal={athleteTotal}
          canEdit={canEdit}
          context={contextSummary}
          draft={draft}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
          onViewChange={requestViewChange}
          onTotalOverrideChange={updateTotalOverride}
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

        <ImportDataModal
          canEdit={canEdit}
          metric={draft.spec.metric}
          onClose={() => setImportOpen(false)}
          open={importOpen}
          pasteValue={pasteValue}
          onCsvUpload={handleCsvUpload}
          onPasteImport={() => void handlePasteImport()}
          onPasteValueChange={setPasteValue}
          onXlsxUpload={handleXlsxUpload}
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
                  Buang
                </button>
                <button
                  className={buttonClassName("h-10 bg-primary-brown text-white hover:bg-primary-brown/90")}
                  disabled={!canEdit || saving}
                  onClick={() => void handleSaveSnapshot()}
                  type="button"
                >
                  <Save className="size-4" />
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingViewChange ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/45 px-4 backdrop-blur-sm">
            <div
              aria-label="Perubahan belum disimpan"
              aria-modal="true"
              className="w-full max-w-lg rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900"
              ref={pendingViewChangeDialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle className="size-5" />
                </span>
                <div>
                  <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Perubahan belum disimpan.</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-400">
                    Simpan atau buang perubahan sebelum pindah ke musim {pendingViewChange.seasonYear}, periode {pendingViewRange}.
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
                  Batal
                </button>
                <button
                  className={buttonClassName("h-10 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200")}
                  disabled={viewChangeSaving}
                  onClick={handleDiscardPendingViewChange}
                  type="button"
                >
                  Buang
                </button>
                <button
                  className={buttonClassName("h-10 bg-primary-brown text-white hover:bg-primary-brown/90")}
                  disabled={!canEdit || viewChangeSaving || saving}
                  onClick={() => void handleSavePendingViewChange()}
                  type="button"
                >
                  <Save className="size-4" />
                  {viewChangeSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingAthleteDelete ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/45 px-4 backdrop-blur-sm">
            <div
              aria-label="Hapus atlet minggu ini"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900"
              ref={pendingAthleteDeleteDialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary-sand/30 text-red-700 dark:bg-zinc-800 dark:text-red-200">
                  <Trash2 className="size-5" />
                </span>
                <div>
                  <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Hapus atlet minggu ini?</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-primary-charcoal/65 dark:text-gray-400">
                    {pendingAthleteDelete.name || "Atlet ini"} akan dilepas dari draft minggu aktif. Klik Simpan agar perubahan tersimpan.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className={buttonClassName("h-10 border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100")}
                  onClick={() => setPendingAthleteDelete(null)}
                  type="button"
                >
                  Batal
                </button>
                <button
                  className={buttonClassName("h-10 border border-red-200/80 bg-red-50/70 text-red-700 hover:bg-red-100/80 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200 dark:hover:bg-red-950/45")}
                  onClick={() => {
                    deleteAthlete(pendingAthleteDelete.id);
                    setPendingAthleteDelete(null);
                  }}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteWeekOpen ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/45 px-4 backdrop-blur-sm">
            <div
              aria-label="Hapus seluruh data minggu ini"
              aria-modal="true"
              className="w-full max-w-lg rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900"
              ref={deleteWeekDialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary-sand/30 text-red-700 dark:bg-zinc-800 dark:text-red-200">
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
                  Batal
                </button>
                <button
                  className={buttonClassName("h-10 border border-red-200/80 bg-red-50/70 text-red-700 hover:bg-red-100/80 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200 dark:hover:bg-red-950/45")}
                  disabled={!deleteWeekConfirmed || deletingWeek}
                  onClick={() => void handleConfirmDeleteWeek()}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  {deletingWeek ? "Membersihkan..." : "Bersihkan minggu"}
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
          refreshingExportPreview={refreshingExportPreview}
          onClose={() => setExportOpen(false)}
          onDownload={() => void handleDownloadExport()}
          onExportAthleteSelectionChange={setExportAthleteSelection}
          onExportPhotoAdjustmentChange={handleExportPhotoAdjustmentChange}
          onExportPhotoAdjustmentReset={handleExportPhotoAdjustmentReset}
          onRefresh={() => void handleRefreshExportPreview()}
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
