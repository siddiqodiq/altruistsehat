import type { FullActivityPayload, PublicActivityPayload } from "./types";
import type { HomeDocumentationCover, HomeSportVisual } from "./home-activity-content";

export type ActivityListItem = PublicActivityPayload &
  Partial<Pick<
    FullActivityPayload,
    "currentAthleteParticipant" | "documentationUrl" | "location" | "participants" | "registrationClosed" | "registrationEnabled" | "visibility"
  >>;

interface ActivitiesResponse {
  activities: ActivityListItem[];
  authenticated: boolean;
}

interface ActivityDetailResponse {
  activity: ActivityListItem;
  authenticated: boolean;
}

interface HomeActivitiesResponse {
  activities: ActivityListItem[];
  documentationCovers: HomeDocumentationCover[];
  sportVisuals: HomeSportVisual[];
  sportTypes: string[];
}

interface ActivityMutationResponse {
  activity: FullActivityPayload;
}

interface ActivityRegistrationResponse {
  activity: ActivityListItem;
  registered: boolean;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : response.statusText;
    throw new Error(message);
  }

  return payload as T;
}

export async function listActivities(): Promise<ActivitiesResponse> {
  const response = await fetch("/api/activities", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ActivitiesResponse>(response);
}

export async function listHomeActivities(): Promise<HomeActivitiesResponse> {
  const response = await fetch("/api/activities/home", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<HomeActivitiesResponse>(response);
}

export async function getActivity(id: string): Promise<ActivityDetailResponse> {
  const response = await fetch(`/api/activities/${id}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ActivityDetailResponse>(response);
}

export async function createActivity(payload: unknown): Promise<FullActivityPayload> {
  const response = await fetch("/api/activities", {
    body: JSON.stringify(payload),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return (await parseJsonResponse<ActivityMutationResponse>(response)).activity;
}

export async function updateActivity(id: string, payload: unknown): Promise<FullActivityPayload> {
  const response = await fetch(`/api/activities/${id}`, {
    body: JSON.stringify(payload),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  return (await parseJsonResponse<ActivityMutationResponse>(response)).activity;
}

export async function deleteActivity(id: string): Promise<void> {
  const response = await fetch(`/api/activities/${id}`, {
    credentials: "same-origin",
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : response.statusText;
    throw new Error(message);
  }
}

export async function joinActivity(id: string): Promise<FullActivityPayload> {
  const response = await fetch(`/api/activities/${id}/participants/me`, {
    credentials: "same-origin",
    method: "POST",
  });
  return (await parseJsonResponse<ActivityMutationResponse>(response)).activity;
}

export async function leaveActivity(id: string): Promise<FullActivityPayload> {
  const response = await fetch(`/api/activities/${id}/participants/me`, {
    credentials: "same-origin",
    method: "DELETE",
  });
  return (await parseJsonResponse<ActivityMutationResponse>(response)).activity;
}

export async function registerActivity(
  id: string,
  payload?: { community: string; name: string; phone: string },
): Promise<ActivityRegistrationResponse> {
  const response = await fetch(`/api/activities/${id}/registrations`, {
    body: JSON.stringify(payload ?? {}),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseJsonResponse<ActivityRegistrationResponse>(response);
}

export async function uploadActivityImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/activities/upload", {
    body: formData,
    credentials: "same-origin",
    method: "POST",
  });
  return (await parseJsonResponse<{ url: string }>(response)).url;
}
