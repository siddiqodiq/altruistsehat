import { normalizeAthleteName } from "./normalize";
import type { AthleteLookupResponse, AthleteRecord } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedLookup {
  athlete: AthleteRecord | null;
  expiresAt: number;
}

interface AthleteLookupOptions {
  forceRefresh?: boolean;
}

const lookupCache = new Map<string, CachedLookup>();

function freshLookup(entry: CachedLookup | undefined, now: number): AthleteRecord | null | undefined {
  if (!entry || entry.expiresAt <= now) {
    return undefined;
  }

  return entry.athlete;
}

export function clearAthleteLookupCache() {
  lookupCache.clear();
}

export async function lookupAthletesByName(
  names: string[],
  options: AthleteLookupOptions = {},
): Promise<Map<string, AthleteRecord | null>> {
  const now = Date.now();
  const normalizedNames = Array.from(new Set(names.map(normalizeAthleteName).filter(Boolean)));
  const result = new Map<string, AthleteRecord | null>();
  const misses: string[] = [];

  normalizedNames.forEach((normalizedName) => {
    if (!options.forceRefresh) {
      const cached = freshLookup(lookupCache.get(normalizedName), now);
      if (cached !== undefined) {
        result.set(normalizedName, cached);
        return;
      }
    }

    misses.push(normalizedName);
  });

  if (!misses.length) {
    return result;
  }

  const response = await fetch("/api/athletes/lookup", {
    cache: options.forceRefresh ? "no-store" : "default",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names: misses }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as AthleteLookupResponse;
  const returnedByName = new Map(payload.athletes.map((athlete) => [athlete.normalizedName, athlete]));

  misses.forEach((normalizedName) => {
    const athlete = returnedByName.get(normalizedName) ?? null;
    lookupCache.set(normalizedName, {
      athlete,
      expiresAt: now + CACHE_TTL_MS,
    });
    result.set(normalizedName, athlete);
  });

  return result;
}
