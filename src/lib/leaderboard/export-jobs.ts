import type { LeaderboardSpec } from "./types";

declare global {
  var __altruistExportJobs: Map<string, LeaderboardSpec> | undefined;
}

function jobStore() {
  globalThis.__altruistExportJobs ??= new Map<string, LeaderboardSpec>();
  return globalThis.__altruistExportJobs;
}

export function createExportJob(spec: LeaderboardSpec): string {
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  jobStore().set(id, spec);
  return id;
}

export function readExportJob(id: string): LeaderboardSpec | undefined {
  return jobStore().get(id);
}

export function deleteExportJob(id: string) {
  jobStore().delete(id);
}
