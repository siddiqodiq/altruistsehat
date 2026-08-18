import type { AthleteRecord } from "@/lib/athletes/types";
import type { LeaderboardWeekSnapshot } from "@/lib/leaderboard/week-snapshots";
import { buildAthleteProfileSummary, type ProfileMileageBySport } from "./summary";

export interface PublicAthleteProfile {
  athlete: {
    id: string;
    name: string;
    normalizedName: string;
    podiumPhotoUrl?: string;
    profilePhotoUrl?: string;
    username?: string;
  };
  mileageBySport: ProfileMileageBySport[];
  sports: string[];
}

export function buildPublicAthleteProfilePayload({
  athlete,
  snapshots,
}: {
  athlete: AthleteRecord;
  snapshots: LeaderboardWeekSnapshot[];
}): PublicAthleteProfile {
  const summary = buildAthleteProfileSummary({
    activitySports: [],
    athlete,
    snapshots,
  });

  return {
    athlete: {
      id: athlete.id,
      name: athlete.name,
      normalizedName: athlete.normalizedName,
      podiumPhotoUrl: athlete.podiumPhotoUrl,
      profilePhotoUrl: athlete.profilePhotoUrl,
      username: athlete.username,
    },
    mileageBySport: summary.mileageBySport,
    sports: summary.sports,
  };
}
