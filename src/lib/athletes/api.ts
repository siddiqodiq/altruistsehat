import type { AthleteRecord } from "./types";
import type { AthletePhotoKind } from "./photo-download";
import type { SportPodiumPhotoUrls } from "./sport-podium-photos";
import type { AthletePodiumPhotoAdjustments } from "../leaderboard/types";

interface AthleteListResponse {
  athletes: AthleteRecord[];
}

interface AthleteMutationResponse {
  athlete: AthleteRecord;
}

export interface AthleteImportSummary {
  totalRows: number;
  created: number;
  skippedDuplicates: number;
  failed: number;
}

export interface AthletePayload {
  name: string;
  profilePhotoUrl?: string;
  podiumPhotoUrl?: string;
  sportPodiumPhotoUrls?: SportPodiumPhotoUrls;
  podiumPhotoAdjustments?: AthletePodiumPhotoAdjustments;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : response.statusText;
    throw new Error(message);
  }

  return payload as T;
}

export async function listAthletes(search = ""): Promise<AthleteRecord[]> {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("q", search.trim());
  }

  const response = await fetch(`/api/athletes${params.size ? `?${params}` : ""}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await parseJsonResponse<AthleteListResponse>(response);
  return payload.athletes;
}

export async function createAthlete(payload: AthletePayload): Promise<AthleteRecord> {
  const response = await fetch("/api/athletes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJsonResponse<AthleteMutationResponse>(response);
  return parsed.athlete;
}

export async function importAthletes(names: string[]): Promise<AthleteImportSummary> {
  const response = await fetch("/api/athletes/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names }),
  });
  const parsed = await parseJsonResponse<{ summary: AthleteImportSummary }>(response);
  return parsed.summary;
}

export async function updateAthleteRecord(id: string, payload: AthletePayload): Promise<AthleteRecord> {
  const response = await fetch(`/api/athletes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJsonResponse<AthleteMutationResponse>(response);
  return parsed.athlete;
}

export async function updateAthletePhotoAdjustments(
  id: string,
  podiumPhotoAdjustments: AthletePodiumPhotoAdjustments,
): Promise<AthleteRecord> {
  const response = await fetch(`/api/athletes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ podiumPhotoAdjustments }),
  });
  const parsed = await parseJsonResponse<AthleteMutationResponse>(response);
  return parsed.athlete;
}

export async function deleteAthleteRecord(id: string): Promise<void> {
  const response = await fetch(`/api/athletes/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
}

function filenameFromContentDisposition(value: string | null, fallback: string): string {
  const match = value?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

export async function downloadAthletePhoto(id: string, kind: AthletePhotoKind): Promise<void> {
  const response = await fetch(`/api/athletes/${id}/photo?kind=${kind}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : response.statusText;
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFromContentDisposition(response.headers.get("content-disposition"), `${kind}-photo.jpg`);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function uploadAthleteImage(file: File, bucket: "athlete-profile" | "athlete-podium"): Promise<string> {
  const formData = new FormData();
  formData.set("bucket", bucket);
  formData.set("file", file);

  const response = await fetch("/api/athletes/upload", {
    method: "POST",
    body: formData,
  });
  const payload = await parseJsonResponse<{ url: string }>(response);
  return payload.url;
}

export async function validateAthleteStorage(): Promise<{
  ok: boolean;
  found: string[];
  created: string[];
  missing: string[];
  error?: string;
}> {
  const response = await fetch("/api/athletes/storage-status", {
    headers: { Accept: "application/json" },
  });

  return parseJsonResponse(response);
}
