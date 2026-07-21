"use client";

import type { CSSProperties, ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { readSheet } from "read-excel-file/browser";
import {
  Bike,
  ChevronDown,
  Clock3,
  Download,
  FileJson,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { LeaderboardCanvas } from "./LeaderboardCanvas";
import { downloadExportFrame } from "@/lib/leaderboard/export-image";
import { listAthletes } from "@/lib/athletes/api";
import { lookupAthletesByName } from "@/lib/athletes/client-cache";
import { enrichAthletesWithDatabase, type AthleteEnrichmentResult } from "@/lib/athletes/enrichment";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import type { AthleteRecord } from "@/lib/athletes/types";
import { parseCsvInput, parseJsonInput, parseSpreadsheetRows } from "@/lib/leaderboard/importers";
import { formatMetricNumber, formatMetricValue, normalizeMetricValue, sumMetricValues } from "@/lib/leaderboard/metrics";
import { DEFAULT_SPEC, LeaderboardSpecSchema } from "@/lib/leaderboard/schema";
import {
  createInitialProjectState,
  migrateStoredProjectState,
  recordExportHistory,
  updateProjectDraft,
  type LeaderboardProjectState,
} from "@/lib/leaderboard/project-state";
import {
  OUTPUT_DIMENSIONS,
  type AthleteEntry,
  type LeaderboardSpec,
  type OutputFormat,
} from "@/lib/leaderboard/types";
import {
  DEFAULT_LEADERBOARD_TEMPLATE_ID,
  DEFAULT_SEASON_YEAR,
  DEFAULT_WEEK_NUMBER,
  FIXED_FOOTER_QUOTE,
  LEADERBOARD_TEMPLATES,
  deriveCurrentTrendTotal,
  derivePreviousWeekTotal,
  deriveSeasonWeekFields,
  getLeaderboardTemplate,
  leaderboardTemplateToSpecPatch,
  type LeaderboardTemplateId,
} from "@/lib/leaderboard/templates";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "altruist-leaderboard:v1";
const CLIENT_STORAGE_KEY = "altruist-leaderboard-client:v1";
const STORY_FORMAT: OutputFormat = "story";

function normalizeTemplateId(value: unknown): LeaderboardTemplateId {
  return getLeaderboardTemplate(String(value ?? "")).id;
}

function deriveGeneratorSpec(
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
  spec: deriveGeneratorSpec(DEFAULT_SPEC, DEFAULT_SEASON_YEAR, DEFAULT_WEEK_NUMBER, DEFAULT_LEADERBOARD_TEMPLATE_ID),
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

function readDraftFromStorage(): LeaderboardProjectState | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return undefined;
  }

  try {
    const raw = JSON.parse(saved) as unknown;
    const projectState = migrateStoredProjectState(raw);
    if (projectState) {
      return projectState;
    }

    const parsed = LeaderboardSpecSchema.safeParse(raw);
    if (!parsed.success) {
      return undefined;
    }

    return createInitialProjectState({
      spec: parsed.data,
      seasonYear: DEFAULT_SEASON_YEAR,
      weekNumber: DEFAULT_WEEK_NUMBER,
      templateId: DEFAULT_LEADERBOARD_TEMPLATE_ID,
    });
  } catch {
    return undefined;
  }
}

function getProjectClientId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const saved = window.localStorage.getItem(CLIENT_STORAGE_KEY);
  if (saved) {
    return saved;
  }

  const clientId = `client-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CLIENT_STORAGE_KEY, clientId);
  return clientId;
}

function isNewerProject(candidate: LeaderboardProjectState, current: LeaderboardProjectState): boolean {
  return new Date(candidate.updatedAt).getTime() > new Date(current.updatedAt).getTime();
}

async function loadProjectFromDatabase(clientId: string): Promise<LeaderboardProjectState | undefined> {
  const response = await fetch(`/api/leaderboard/projects/latest?clientId=${encodeURIComponent(clientId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return undefined;
  }

  if (typeof response.json !== "function") {
    return undefined;
  }

  const payload = (await response.json().catch(() => null)) as { project?: unknown } | null;
  return migrateStoredProjectState(payload?.project);
}

async function saveProjectToDatabase(clientId: string, project: LeaderboardProjectState): Promise<void> {
  await fetch("/api/leaderboard/projects/latest", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, project }),
  });
}

function formatExportedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved export";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ControlField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 text-sm font-semibold text-zinc-700">
      <span>{label}</span>
      {children}
    </div>
  );
}

function inputClassName(extra?: string) {
  return cn(
    "min-h-11 w-full rounded-[8px] border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10",
    extra,
  );
}

function initialsForName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] ?? "A").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function athleteRecordPatch(record: AthleteRecord): Partial<AthleteEntry> {
  return {
    athleteId: record.id,
    name: record.name,
    normalizedName: record.normalizedName,
    avatarDataUrl: record.profilePhotoUrl,
    podiumPhotoAdjustments: record.podiumPhotoAdjustments,
    profilePhotoUrl: record.profilePhotoUrl,
    podiumPhotoUrl: record.podiumPhotoUrl,
  };
}

function AthleteIdentityMark({
  name,
  src,
  className,
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-950 text-[11px] font-black text-white",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={src} />
      ) : (
        initialsForName(name)
      )}
    </span>
  );
}

function AthleteSelector({
  athlete,
  error,
  index,
  isLoading,
  isOpen,
  onOpen,
  onRetry,
  onSearchChange,
  onSelect,
  options,
  searchValue,
}: {
  athlete: AthleteEntry;
  error: string | null;
  index: number;
  isLoading: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (record: AthleteRecord) => void;
  options: AthleteRecord[];
  searchValue: string;
}) {
  const normalizedSearch = normalizeAthleteName(searchValue);
  const filteredOptions = normalizedSearch
    ? options.filter((record) => record.normalizedName.includes(normalizedSearch))
    : options;
  const selectedImage = athlete.profilePhotoUrl ?? athlete.avatarDataUrl;

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={athlete.name ? `Selected athlete ${athlete.name}` : `Select athlete for row ${index + 1}`}
        className={cn(inputClassName("flex items-center gap-3 px-3 text-left"), "justify-between")}
        onClick={onOpen}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <AthleteIdentityMark className="size-7" name={athlete.name || "Athlete"} src={selectedImage} />
          <span className={cn("min-w-0 truncate", athlete.name ? "text-zinc-950" : "text-zinc-400")}>
            {athlete.name || "Select athlete"}
          </span>
        </span>
        <ChevronDown className="shrink-0 text-zinc-400" size={16} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[8px] border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-950/10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
            <input
              aria-label={`Search athletes for row ${index + 1}`}
              className={inputClassName("min-h-10 pl-9")}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search athlete"
              value={searchValue}
            />
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto" role="listbox">
            {isLoading ? (
              <div className="px-3 py-3 text-sm font-semibold text-zinc-500">Loading athletes...</div>
            ) : error ? (
              <div className="grid gap-2 px-3 py-3 text-sm font-semibold text-red-600">
                <span>{error}</span>
                <button className="text-left font-black text-zinc-950 underline" onClick={onRetry} type="button">
                  Retry athlete database
                </button>
              </div>
            ) : filteredOptions.length ? (
              filteredOptions.map((record) => (
                <button
                  aria-selected={athlete.athleteId === record.id}
                  className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-sm font-black text-zinc-950 hover:bg-zinc-100"
                  key={record.id}
                  onClick={() => onSelect(record)}
                  role="option"
                  type="button"
                >
                  <AthleteIdentityMark className="size-8" name={record.name} src={record.profilePhotoUrl} />
                  <span className="min-w-0 truncate">{record.name}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm font-semibold text-zinc-500">No athletes found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseTrendValuesInput(input: string, metric: LeaderboardSpec["metric"]): number[] {
  return input
    .split(/[;\n]|\s*,\s+(?=\d)/)
    .map((value) => normalizeMetricValue(value, metric))
    .filter((value) => Number.isFinite(value));
}

function formatTrendValuesInput(values: number[]): string {
  return values.map((value) => formatMetricNumber(value, 1)).join("; ");
}

function importStatusText(result: AthleteEnrichmentResult): string {
  const total = result.athletes.length;
  const base = `Imported ${total} athlete${total === 1 ? "" : "s"}`;
  const lookupFailed = result.warnings.some((warning) => warning.reason === "lookup_failed");

  if (lookupFailed) {
    return `${base}. Athlete database unavailable; using initials.`;
  }

  if (result.warnings.length) {
    const names = result.warnings
      .slice(0, 4)
      .map((warning) => warning.name)
      .join(", ");
    const suffix = result.warnings.length > 4 ? ` +${result.warnings.length - 4} more` : "";
    return `${base}. Matched ${result.matchedCount} from database. Missing athlete photos: ${names}${suffix}.`;
  }

  if (result.matchedCount) {
    return `${base}. Matched ${result.matchedCount} from database.`;
  }

  return base;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-zinc-200 px-5 py-5 last:border-b-0">
      <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-zinc-950">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function GeneratorApp() {
  const [draft, setDraft] = useState<LeaderboardProjectState>(DEFAULT_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [pasteValue, setPasteValue] = useState("Utha,128.4\nAndi,120.1\nBudi,112.3");
  const [status, setStatus] = useState("Ready");
  const [exporting, setExporting] = useState(false);
  const [athleteOptions, setAthleteOptions] = useState<AthleteRecord[]>([]);
  const [athleteOptionsLoaded, setAthleteOptionsLoaded] = useState(false);
  const [athleteOptionsLoading, setAthleteOptionsLoading] = useState(false);
  const [athleteOptionsError, setAthleteOptionsError] = useState<string | null>(null);
  const [openAthleteId, setOpenAthleteId] = useState<string | null>(null);
  const [athleteSearchValue, setAthleteSearchValue] = useState("");
  const exportFrameRef = useRef<HTMLDivElement>(null);
  const dimensions = OUTPUT_DIMENSIONS[STORY_FORMAT];
  const spec = useMemo(
    () => deriveGeneratorSpec(draft.spec, draft.seasonYear, draft.weekNumber, draft.templateId),
    [draft],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const saved = readDraftFromStorage();
      if (saved) {
        setDraft(saved);
      }
      setHydrated(true);
    });

    const clientId = getProjectClientId();
    if (!clientId) {
      return;
    }

    let cancelled = false;
    void loadProjectFromDatabase(clientId)
      .then((remoteProject) => {
        if (!remoteProject || cancelled) {
          return;
        }

        setDraft((current) => (isNewerProject(remoteProject, current) ? remoteProject : current));
      })
      .catch((error) => {
        console.warn("LEADERBOARD_PROJECT_LOAD_SKIPPED", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const parsed = LeaderboardSpecSchema.safeParse(spec);
    if (!parsed.success || typeof window === "undefined") {
      return;
    }

    const timeout = window.setTimeout(() => {
      const project = {
        projectId: draft.projectId,
        status: draft.status,
        spec: parsed.data,
        seasonYear: draft.seasonYear,
        weekNumber: draft.weekNumber,
        templateId: draft.templateId,
        exportHistory: draft.exportHistory,
        updatedAt: new Date().toISOString(),
      } satisfies LeaderboardProjectState;

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(project),
      );

      const clientId = getProjectClientId();
      if (clientId) {
        void saveProjectToDatabase(clientId, project).catch((error) => {
          console.warn("LEADERBOARD_PROJECT_SAVE_SKIPPED", error);
        });
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [draft.exportHistory, draft.projectId, draft.seasonYear, draft.status, draft.templateId, draft.weekNumber, hydrated, spec]);

  const athleteTotal = useMemo(() => sumMetricValues(spec.athletes), [spec.athletes]);
  const displayTotal = useMemo(
    () => deriveCurrentTrendTotal(spec.trendValues, athleteTotal),
    [athleteTotal, spec.trendValues],
  );
  const latestExport = draft.exportHistory[0];

  function updateSpec(patch: Partial<LeaderboardSpec>) {
    setDraft((current) => updateProjectDraft(current, { spec: { ...current.spec, ...patch } }));
  }

  function updateAthlete(id: string, patch: Partial<AthleteEntry>) {
    setDraft((current) =>
      updateProjectDraft(current, {
        spec: {
          ...current.spec,
          athletes: current.spec.athletes.map((athlete) => (athlete.id === id ? { ...athlete, ...patch } : athlete)),
        },
      }),
    );
  }

  async function loadAthleteOptions(force = false) {
    if (athleteOptionsLoading || (athleteOptionsLoaded && !force)) {
      return;
    }

    setAthleteOptionsLoading(true);
    setAthleteOptionsError(null);
    try {
      setAthleteOptions(await listAthletes());
      setAthleteOptionsLoaded(true);
    } catch (error) {
      setAthleteOptionsError(`Could not load athletes: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAthleteOptionsLoading(false);
    }
  }

  function toggleAthleteSelector(id: string) {
    const willOpen = openAthleteId !== id;
    setOpenAthleteId(willOpen ? id : null);
    setAthleteSearchValue("");

    if (willOpen) {
      void loadAthleteOptions();
    }
  }

  function selectDatabaseAthlete(rowId: string, record: AthleteRecord) {
    updateAthlete(rowId, athleteRecordPatch(record));
    setOpenAthleteId(null);
    setAthleteSearchValue("");
  }

  async function enrichImportedAthletes(athletes: AthleteEntry[]): Promise<AthleteEnrichmentResult> {
    if (!athletes.length) {
      return { athletes, matchedCount: 0, warnings: [] };
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

      return enrichAthletesWithDatabase(athletes, matched);
    } catch {
      return {
        athletes,
        matchedCount: 0,
        warnings: athletes.map((athlete) => ({ name: athlete.name, reason: "lookup_failed" })),
      };
    }
  }

  async function replaceAthletes(athletes: AthleteEntry[]) {
    const enriched = await enrichImportedAthletes(athletes);
    updateSpec({ athletes: enriched.athletes.length ? enriched.athletes : spec.athletes });
    setStatus(importStatusText(enriched));
  }

  async function handlePasteImport() {
    try {
      const trimmed = pasteValue.trim();
      if (!trimmed) {
        throw new Error("Paste data before importing.");
      }

      const athletes = trimmed.startsWith("[") || trimmed.startsWith("{")
        ? parseJsonInput(trimmed, spec.metric)
        : parseCsvInput(trimmed, spec.metric);
      await replaceAthletes(athletes);
    } catch (error) {
      setStatus(`Could not import data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      await replaceAthletes(parseCsvInput(text, spec.metric));
    } catch (error) {
      setStatus(`Could not import CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function handleXlsxUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rows = await readSheet(file);
      await replaceAthletes(parseSpreadsheetRows(rows, spec.metric));
    } catch (error) {
      setStatus(`Could not import XLSX: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      event.target.value = "";
    }
  }

  async function handleExport() {
    setExporting(true);
    setStatus("Rendering PNG");
    setDraft((current) => updateProjectDraft(current, { status: "Exporting" }));
    try {
      const { filename, size } = await downloadExportFrame(exportFrameRef.current, STORY_FORMAT);
      setDraft((current) =>
        recordExportHistory(current, {
          filename,
          format: STORY_FORMAT,
          size,
        }),
      );
      setStatus("PNG downloaded");
    } catch (error) {
      setDraft((current) => updateProjectDraft(current, { status: "Draft" }));
      setStatus(error instanceof Error ? error.message : "Export failed. Reason: Unknown error. Try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f4f1] text-zinc-950" data-hydrated={hydrated ? "true" : "false"} data-testid="generator-app">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[520px_1fr]">
        <aside className="max-h-screen overflow-y-auto border-r border-zinc-200 bg-white">
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-black tracking-normal text-zinc-950">Altruist Leaderboard</h1>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {draft.status} · {formatMetricValue(displayTotal, spec.metric)} ready for export
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  className="grid size-11 place-items-center rounded-[8px] border border-zinc-200 bg-white text-zinc-700"
                  href="/athletes"
                  title="Athlete Database"
                >
                  <Users size={17} />
                </Link>
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-zinc-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={exporting}
                  onClick={handleExport}
                  type="button"
                >
                  <Download size={17} />
                  Download PNG
                </button>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-zinc-600" role="status">
              {status}
            </div>
          </div>

          <Section icon={<Trophy size={17} />} title="Event">
            <div className="grid gap-4">
              <fieldset className="grid gap-2">
                <legend className="text-sm font-semibold text-zinc-700">Leaderboard Period</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Season Year">
                    <input
                      className={inputClassName()}
                      min="1"
                      onChange={(event) => setDraft((current) => updateProjectDraft(current, { seasonYear: event.target.value }))}
                      type="number"
                      value={draft.seasonYear}
                    />
                  </Field>
                  <Field label="Week Number">
                    <input
                      className={inputClassName()}
                      min="1"
                      onChange={(event) => setDraft((current) => updateProjectDraft(current, { weekNumber: event.target.value }))}
                      type="number"
                      value={draft.weekNumber}
                    />
                  </Field>
                </div>
              </fieldset>
              <Field label="Leaderboard Template">
                <select
                  className={inputClassName()}
                  onChange={(event) =>
                    setDraft((current) => updateProjectDraft(current, { templateId: normalizeTemplateId(event.target.value) }))
                  }
                  value={draft.templateId}
                >
                  {LEADERBOARD_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trend Values">
                <input
                  className={inputClassName()}
                  onChange={(event) =>
                    updateSpec({
                      trendValues: parseTrendValuesInput(event.target.value, spec.metric),
                    })
                  }
                  value={formatTrendValuesInput(spec.trendValues)}
                />
              </Field>
            </div>
          </Section>

          <Section icon={<Clock3 size={17} />} title="Export History">
            <div className="grid gap-3">
              {latestExport ? (
                <div className="grid gap-2 rounded-[8px] border border-zinc-200 bg-zinc-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-zinc-950">{latestExport.filename}</p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      Week {latestExport.weekNumber} · {formatExportedAt(latestExport.timestamp)}
                    </p>
                  </div>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-zinc-200 bg-white text-sm font-black text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={exporting}
                    onClick={handleExport}
                    type="button"
                  >
                    <Download size={15} />
                    Re-download
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-zinc-500">Exports will appear here after the first PNG download.</p>
              )}
            </div>
          </Section>

          <Section icon={<FileJson size={17} />} title="Import">
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-zinc-700" htmlFor="paste-data">
                <span>Paste leaderboard data</span>
                <textarea
                  className={inputClassName("min-h-28 py-3 font-mono")}
                  id="paste-data"
                  onChange={(event) => setPasteValue(event.target.value)}
                  value={pasteValue}
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-zinc-950 text-sm font-black text-white"
                  onClick={handlePasteImport}
                  type="button"
                >
                  <Upload size={16} />
                  Import Paste
                </button>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-zinc-200 bg-white text-sm font-black">
                  <FileSpreadsheet size={16} />
                  CSV
                  <input accept=".csv,text/csv" className="sr-only" onChange={handleCsvUpload} type="file" />
                </label>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-zinc-200 bg-white text-sm font-black">
                  <FileSpreadsheet size={16} />
                  XLSX
                  <input
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    onChange={handleXlsxUpload}
                    type="file"
                  />
                </label>
              </div>
            </div>
          </Section>

          <Section icon={<Bike size={17} />} title="Athletes">
            <div className="grid gap-3">
              {spec.athletes.map((athlete, index) => (
                <div className="grid grid-cols-[34px_minmax(0,1fr)_112px_40px] items-end gap-2" key={athlete.id}>
                  <div className="pb-3 text-sm font-black text-zinc-400">#{index + 1}</div>
                  <ControlField label={index === 0 ? "Athlete" : " "}>
                    <AthleteSelector
                      athlete={athlete}
                      error={athleteOptionsError}
                      index={index}
                      isLoading={athleteOptionsLoading}
                      isOpen={openAthleteId === athlete.id}
                      onOpen={() => toggleAthleteSelector(athlete.id)}
                      onRetry={() => void loadAthleteOptions(true)}
                      onSearchChange={setAthleteSearchValue}
                      onSelect={(record) => selectDatabaseAthlete(athlete.id, record)}
                      options={athleteOptions}
                      searchValue={athleteSearchValue}
                    />
                  </ControlField>
                  <Field label={index === 0 ? "Value" : " "}>
                    <input
                      className={inputClassName()}
                      onChange={(event) =>
                        updateAthlete(athlete.id, { value: normalizeMetricValue(event.target.value, spec.metric) })
                      }
                      value={athlete.value}
                    />
                  </Field>
                  <button
                    aria-label={`Remove ${athlete.name || `athlete ${index + 1}`}`}
                    className="mb-1 grid size-9 place-items-center rounded-[8px] border border-zinc-200 bg-white text-zinc-500"
                    onClick={() => {
                      const remaining = spec.athletes.filter((row) => row.id !== athlete.id);
                      updateSpec({ athletes: remaining.length ? remaining : [nextAthlete()] });
                    }}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-dashed border-zinc-300 bg-zinc-50 text-sm font-black text-zinc-700"
                onClick={() => updateSpec({ athletes: [...spec.athletes, nextAthlete()] })}
                type="button"
              >
                <Plus size={16} />
                Add Athlete
              </button>
            </div>
          </Section>
        </aside>

        <section className="flex min-h-screen items-center justify-center overflow-auto p-4 sm:p-8 lg:p-10">
          <div
            className="leaderboard-preview"
            data-format={STORY_FORMAT}
            data-testid="preview-frame"
            ref={exportFrameRef}
            style={
              {
                "--preview-width": `${dimensions.width}px`,
                "--preview-height": `${dimensions.height}px`,
                "--preview-scale": "0.35",
              } as CSSProperties
            }
          >
            <LeaderboardCanvas format={STORY_FORMAT} spec={spec} />
          </div>
        </section>
      </div>
    </main>
  );
}
