import type { AthleteEntry } from "@/lib/leaderboard/types";
import { normalizeAthleteName } from "./normalize";
import type { AthleteDatabaseWarning, AthleteRecord } from "./types";

export interface AthleteEnrichmentResult {
  athletes: AthleteEntry[];
  matchedCount: number;
  warnings: AthleteDatabaseWarning[];
}

export function enrichAthletesWithDatabase(athletes: AthleteEntry[], databaseAthletes: AthleteRecord[]): AthleteEnrichmentResult {
  const recordsByName = new Map(databaseAthletes.map((athlete) => [athlete.normalizedName, athlete]));
  let matchedCount = 0;
  const warnings: AthleteDatabaseWarning[] = [];

  const enriched = athletes.map((athlete) => {
    const normalizedName = normalizeAthleteName(athlete.name);
    const matched = recordsByName.get(normalizedName);

    if (!matched) {
      warnings.push({ name: athlete.name, reason: "not_found" });
      return athlete;
    }

    matchedCount += 1;

    return {
      ...athlete,
      athleteId: matched.id,
      name: matched.name,
      normalizedName: matched.normalizedName,
      podiumPhotoAdjustments: matched.podiumPhotoAdjustments,
      profilePhotoUrl: matched.profilePhotoUrl,
      podiumPhotoUrl: matched.podiumPhotoUrl,
      sportPodiumPhotoUrls: matched.sportPodiumPhotoUrls,
      avatarDataUrl: matched.profilePhotoUrl ?? athlete.avatarDataUrl,
    };
  });

  return { athletes: enriched, matchedCount, warnings };
}
