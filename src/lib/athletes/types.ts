import type { AthletePodiumPhotoAdjustments } from "../leaderboard/types";
import type { SportPodiumPhotoUrls } from "./sport-podium-photos";

export interface AthleteRecord {
  id: string;
  name: string;
  normalizedName: string;
  profilePhotoUrl?: string;
  podiumPhotoUrl?: string;
  sportPodiumPhotoUrls?: SportPodiumPhotoUrls;
  podiumPhotoAdjustments?: AthletePodiumPhotoAdjustments;
  createdAt?: string;
  updatedAt?: string;
}

export interface AthleteDatabaseWarning {
  name: string;
  reason: "not_found" | "lookup_failed";
}

export interface AthleteLookupResponse {
  athletes: AthleteRecord[];
}
