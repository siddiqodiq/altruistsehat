import type { AthleteEntry, RankedAthlete } from "./types";

export function buildLeaderboardRows(athletes: AthleteEntry[], limit = 10): RankedAthlete[] {
  return athletes
    .map((athlete, index) => ({ athlete, index }))
    .filter(({ athlete }) => athlete.name.trim() && Number.isFinite(athlete.value))
    .sort((left, right) => {
      if (right.athlete.value !== left.athlete.value) {
        return right.athlete.value - left.athlete.value;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ athlete }, index) => {
      const rank = index + 1;
      return {
        ...athlete,
        rank,
      };
    });
}
