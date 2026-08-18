import { normalizeAthleteName } from "@/lib/athletes/normalize";
import type { AthleteRecord } from "@/lib/athletes/types";
import { specWithDatabaseAthletePhotos } from "@/lib/leaderboard/export-client";
import type { LeaderboardProjectState } from "@/lib/leaderboard/project-state";

export type LeaderboardAthletePhotoLookup = (names: string[]) => Promise<AthleteRecord[]>;

function uniqueAthleteNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const name of names) {
    const normalizedName = normalizeAthleteName(name);
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    unique.push(name.trim());
  }

  return unique;
}

export async function hydrateLeaderboardProjectAthletePhotos(
  project: LeaderboardProjectState,
  lookup: LeaderboardAthletePhotoLookup,
): Promise<LeaderboardProjectState> {
  const names = uniqueAthleteNames(project.spec.athletes.map((athlete) => athlete.name));
  if (!names.length) {
    return project;
  }

  const databaseAthletes = await lookup(names);
  if (!databaseAthletes.length) {
    return project;
  }

  return {
    ...project,
    spec: specWithDatabaseAthletePhotos(project.spec, databaseAthletes),
  };
}
