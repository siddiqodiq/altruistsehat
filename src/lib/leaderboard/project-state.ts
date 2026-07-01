import { z } from "zod";
import { LeaderboardSpecSchema } from "./schema";
import type { LeaderboardSpec, OutputFormat } from "./types";
import { DEFAULT_LEADERBOARD_TEMPLATE_ID, DEFAULT_SEASON_YEAR, DEFAULT_WEEK_NUMBER, type LeaderboardTemplateId } from "./templates";

export type LeaderboardProjectStatus = "Draft" | "Exporting" | "Exported" | "Archived";

export const LeaderboardProjectStatusSchema = z.enum(["Draft", "Exporting", "Exported", "Archived"]);

export const LeaderboardExportRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  weekNumber: z.string(),
  format: z.enum(["story", "feed"]),
  filename: z.string().min(1),
  size: z.number().nonnegative(),
});

export const LeaderboardProjectStateSchema = z.object({
  projectId: z.string().min(1),
  status: LeaderboardProjectStatusSchema,
  spec: LeaderboardSpecSchema,
  seasonYear: z.string(),
  weekNumber: z.string(),
  templateId: z.string().min(1).transform((value) => normalizeTemplateId(value)),
  exportHistory: z.array(LeaderboardExportRecordSchema),
  updatedAt: z.string().min(1),
});

export interface LeaderboardExportRecord {
  id: string;
  timestamp: string;
  weekNumber: string;
  format: OutputFormat;
  filename: string;
  size: number;
}

export interface LeaderboardProjectState {
  projectId: string;
  status: LeaderboardProjectStatus;
  spec: LeaderboardSpec;
  seasonYear: string;
  weekNumber: string;
  templateId: LeaderboardTemplateId;
  exportHistory: LeaderboardExportRecord[];
  updatedAt: string;
}

export interface ProjectDraftInput {
  spec: LeaderboardSpec;
  seasonYear: string;
  weekNumber: string;
  templateId: LeaderboardTemplateId;
}

function randomId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTemplateId(value: unknown): LeaderboardTemplateId {
  const text = String(value ?? "");
  return text ? (text as LeaderboardTemplateId) : DEFAULT_LEADERBOARD_TEMPLATE_ID;
}

export function createInitialProjectState(input: ProjectDraftInput): LeaderboardProjectState {
  return {
    projectId: randomId("leaderboard"),
    status: "Draft",
    spec: input.spec,
    seasonYear: input.seasonYear,
    weekNumber: input.weekNumber,
    templateId: input.templateId,
    exportHistory: [],
    updatedAt: nowIso(),
  };
}

export function migrateStoredProjectState(raw: unknown): LeaderboardProjectState | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as Partial<LeaderboardProjectState> & Partial<ProjectDraftInput>;
  const parsed = LeaderboardSpecSchema.safeParse(record.spec);
  if (!parsed.success) {
    return undefined;
  }

  const status = ["Draft", "Exporting", "Exported", "Archived"].includes(String(record.status))
    ? (record.status as LeaderboardProjectStatus)
    : "Draft";

  return {
    projectId: typeof record.projectId === "string" ? record.projectId : randomId("leaderboard"),
    status,
    spec: parsed.data,
    seasonYear: typeof record.seasonYear === "string" ? record.seasonYear : DEFAULT_SEASON_YEAR,
    weekNumber: typeof record.weekNumber === "string" ? record.weekNumber : DEFAULT_WEEK_NUMBER,
    templateId: normalizeTemplateId(record.templateId),
    exportHistory: Array.isArray(record.exportHistory) ? record.exportHistory.filter(isExportRecord) : [],
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : nowIso(),
  };
}

function isExportRecord(value: unknown): value is LeaderboardExportRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<LeaderboardExportRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.timestamp === "string" &&
    typeof record.weekNumber === "string" &&
    (record.format === "story" || record.format === "feed") &&
    typeof record.filename === "string" &&
    typeof record.size === "number"
  );
}

export function updateProjectDraft(
  current: LeaderboardProjectState,
  patch: Partial<ProjectDraftInput> & { status?: LeaderboardProjectStatus },
): LeaderboardProjectState {
  return {
    ...current,
    ...patch,
    status: patch.status ?? (current.status === "Archived" ? "Archived" : "Draft"),
    updatedAt: nowIso(),
  };
}

export function recordExportHistory(
  current: LeaderboardProjectState,
  exportRecord: Omit<LeaderboardExportRecord, "id" | "timestamp" | "weekNumber">,
): LeaderboardProjectState {
  const record: LeaderboardExportRecord = {
    ...exportRecord,
    id: randomId("export"),
    timestamp: nowIso(),
    weekNumber: current.weekNumber,
  };

  return {
    ...current,
    status: "Exported",
    exportHistory: [record, ...current.exportHistory].slice(0, 20),
    updatedAt: nowIso(),
  };
}
