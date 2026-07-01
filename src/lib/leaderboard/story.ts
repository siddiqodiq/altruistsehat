import { resolveMetricTotal } from "./metrics";
import { buildLeaderboardRows } from "./ranking";
import type { AthleteEntry, RankedAthlete } from "./types";
import { type LeaderboardWeekSnapshot } from "./week-snapshots";

export interface AthleteMovement {
  key: string;
  name: string;
  delta: number;
  fromRank?: number;
  toRank: number;
}

export interface LeaderboardStory {
  athleteCount: number;
  biggestDrop?: AthleteMovement;
  leader?: RankedAthlete;
  leaderMovement?: AthleteMovement;
  leaderStreak?: number;
  movementByAthleteKey: Record<string, AthleteMovement>;
  previousTotal?: number;
  topMover?: AthleteMovement;
  totalDeltaPercent?: number;
}

export function leaderboardStoryAthleteKey(athlete: Pick<AthleteEntry, "athleteId" | "normalizedName" | "name">): string {
  return athlete.athleteId ?? athlete.normalizedName ?? athlete.name.trim().toLowerCase();
}

function snapshotIdentity(snapshot: LeaderboardWeekSnapshot) {
  return `${snapshot.seasonYear}:${snapshot.weekNumber}:${snapshot.templateId}`;
}

function snapshotTotal(snapshot: LeaderboardWeekSnapshot) {
  return snapshot.total ?? resolveMetricTotal(snapshot.spec.athletes, snapshot.spec.totalOverride);
}

function calculateLeaderStreak(currentIndex: number, snapshots: LeaderboardWeekSnapshot[], leaderKey: string) {
  let streak = 0;

  for (let index = currentIndex; index >= 0; index -= 1) {
    const top = buildLeaderboardRows(snapshots[index].spec.athletes, Math.max(10, snapshots[index].spec.athletes.length))[0];
    if (!top || leaderboardStoryAthleteKey(top) !== leaderKey) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export function buildLeaderboardStory(
  currentSnapshot: LeaderboardWeekSnapshot | undefined,
  snapshots: LeaderboardWeekSnapshot[],
): LeaderboardStory {
  if (!currentSnapshot) {
    return { athleteCount: 0, movementByAthleteKey: {} };
  }

  const currentRows = buildLeaderboardRows(currentSnapshot.spec.athletes, Math.max(10, currentSnapshot.spec.athletes.length));
  const currentIndex = snapshots.findIndex((snapshot) => snapshotIdentity(snapshot) === snapshotIdentity(currentSnapshot));
  const previousSnapshot = currentIndex > 0 ? snapshots[currentIndex - 1] : undefined;
  const previousRanks = new Map<string, number>();

  if (previousSnapshot) {
    buildLeaderboardRows(previousSnapshot.spec.athletes, Math.max(10, previousSnapshot.spec.athletes.length)).forEach((athlete) => {
      previousRanks.set(leaderboardStoryAthleteKey(athlete), athlete.rank);
    });
  }

  const movements = currentRows.map((athlete) => {
    const key = leaderboardStoryAthleteKey(athlete);
    const fromRank = previousRanks.get(key);
    return {
      key,
      name: athlete.name,
      delta: fromRank ? fromRank - athlete.rank : 0,
      fromRank,
      toRank: athlete.rank,
    } satisfies AthleteMovement;
  });
  const movementByAthleteKey = Object.fromEntries(movements.map((movement) => [movement.key, movement]));
  const topMover = movements
    .filter((movement) => movement.delta > 0)
    .sort((left, right) => right.delta - left.delta || left.toRank - right.toRank)[0];
  const biggestDrop = movements
    .filter((movement) => movement.delta < 0)
    .sort((left, right) => left.delta - right.delta || right.toRank - left.toRank)[0];
  const leader = currentRows[0];
  const leaderKey = leader ? leaderboardStoryAthleteKey(leader) : undefined;
  const leaderMovement = leaderKey ? movementByAthleteKey[leaderKey] : undefined;
  const currentTotal = snapshotTotal(currentSnapshot);
  const previousTotal = previousSnapshot ? snapshotTotal(previousSnapshot) : undefined;
  const totalDeltaPercent = previousTotal && previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : undefined;

  return {
    athleteCount: currentRows.length,
    biggestDrop,
    leader,
    leaderMovement,
    leaderStreak: leaderKey && currentIndex >= 0 ? calculateLeaderStreak(currentIndex, snapshots, leaderKey) : undefined,
    movementByAthleteKey,
    previousTotal,
    topMover,
    totalDeltaPercent,
  };
}
