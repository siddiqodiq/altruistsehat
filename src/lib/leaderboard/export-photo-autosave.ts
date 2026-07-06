import { normalizeAthleteName } from "../athletes/normalize";
import {
  clampExportPhotoAdjustment,
  normalizeAthletePodiumPhotoAdjustments,
} from "./photo-adjustments";
import type {
  AthleteEntry,
  AthletePodiumPhotoAdjustments,
  ExportLayoutMode,
  ExportPhotoAdjustment,
  LeaderboardSpec,
} from "./types";

export const EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY = "altruist-export-photo-adjustments:v1";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type LocalExportPhotoAdjustments = Record<string, AthletePodiumPhotoAdjustments>;

function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function athleteStorageKey(athlete: Pick<AthleteEntry, "athleteId" | "name" | "normalizedName">) {
  return athlete.athleteId ?? athlete.normalizedName ?? normalizeAthleteName(athlete.name);
}

function readLocalExportPhotoAdjustments(storage: StorageLike | undefined = browserStorage()): LocalExportPhotoAdjustments {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        const normalized = normalizeAthletePodiumPhotoAdjustments(value);
        return Object.keys(normalized).length ? [[key, normalized]] : [];
      }),
    );
  } catch {
    storage.removeItem(EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY);
    return {};
  }
}

export function localExportPhotoAdjustmentsForAthlete({
  athlete,
  storage,
}: {
  athlete: Pick<AthleteEntry, "athleteId" | "id" | "name" | "normalizedName">;
  storage?: StorageLike;
}): AthletePodiumPhotoAdjustments | undefined {
  const key = athleteStorageKey(athlete);
  if (!key) {
    return undefined;
  }

  return readLocalExportPhotoAdjustments(storage)[key];
}

export function writeLocalExportPhotoAdjustment({
  adjustment,
  athlete,
  layoutMode,
  storage = browserStorage(),
}: {
  adjustment: ExportPhotoAdjustment;
  athlete: Pick<AthleteEntry, "athleteId" | "id" | "name" | "normalizedName">;
  layoutMode: ExportLayoutMode;
  storage?: StorageLike;
}) {
  const key = athleteStorageKey(athlete);
  if (!storage || !key) {
    return;
  }

  const current = readLocalExportPhotoAdjustments(storage);
  storage.setItem(
    EXPORT_PHOTO_ADJUSTMENTS_STORAGE_KEY,
    JSON.stringify({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        [layoutMode]: clampExportPhotoAdjustment(adjustment),
      },
    }),
  );
}

export function specWithLocalExportPhotoAdjustments(
  spec: LeaderboardSpec,
  storage: StorageLike | undefined = browserStorage(),
): LeaderboardSpec {
  const localAdjustments = readLocalExportPhotoAdjustments(storage);
  if (!Object.keys(localAdjustments).length) {
    return spec;
  }

  return {
    ...spec,
    athletes: spec.athletes.map((athlete) => {
      const key = athleteStorageKey(athlete);
      const local = key ? localAdjustments[key] : undefined;
      if (!local) {
        return athlete;
      }

      return {
        ...athlete,
        podiumPhotoAdjustments: {
          ...local,
          ...(athlete.podiumPhotoAdjustments ?? {}),
        },
      };
    }),
  };
}
