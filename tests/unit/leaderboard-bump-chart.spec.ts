import { expect, test } from "@playwright/test";
import { buildBumpChartData, calculateTopMovers } from "../../src/lib/leaderboard/bump-chart";
import type { LeaderboardWeekSnapshot } from "../../src/lib/leaderboard/week-snapshots";

function snapshot(weekNumber: string, athletes: Array<[string, number]>, dateRange?: string): LeaderboardWeekSnapshot {
  return {
    clientId: "altruist-sehat",
    seasonYear: "2026",
    weekNumber,
    templateId: "running_weekly_mileage",
    spec: {
      dateRange,
      athletes: athletes.map(([name, value]) => ({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        normalizedName: name.toLowerCase(),
        value,
      })),
      metric: "distance_km",
    },
    total: athletes.reduce((sum, [, value]) => sum + value, 0),
    athleteCount: athletes.length,
    exportedAt: `2026-06-${weekNumber.padStart(2, "0")}T00:00:00.000Z`,
  } as LeaderboardWeekSnapshot;
}

test("buildBumpChartData transforms weekly values into rank movement", () => {
  const data = buildBumpChartData([
    snapshot("22", [
      ["Rakha", 50],
      ["Stefanus", 40],
      ["Aryo", 35],
    ]),
    snapshot("23", [
      ["Aryo", 70],
      ["Rakha", 60],
      ["Stefanus", 20],
    ]),
  ]);

  const aryo = data.series.find((series) => series.name === "Aryo");
  const rakha = data.series.find((series) => series.name === "Rakha");

  expect(data.weeks.map((week) => week.label)).toEqual(["W22", "W23"]);
  expect(aryo?.points.map((point) => point.rank)).toEqual([3, 1]);
  expect(aryo?.rankDelta).toBe(2);
  expect(rakha?.points.map((point) => point.rank)).toEqual([1, 2]);
  expect(rakha?.rankDelta).toBe(-1);
});

test("calculateTopMovers separates biggest climbs and drops", () => {
  const data = buildBumpChartData([
    snapshot("24", [
      ["A", 100],
      ["B", 90],
      ["C", 80],
      ["D", 70],
      ["E", 60],
    ]),
    snapshot("25", [
      ["E", 120],
      ["D", 110],
      ["A", 100],
      ["B", 90],
      ["C", 80],
    ]),
  ]);

  const movers = calculateTopMovers(data.series, 2);

  expect(movers.movers.map((item) => [item.name, item.delta])).toEqual([
    ["E", 4],
    ["D", 2],
  ]);
  expect(movers.drops.map((item) => [item.name, item.delta])).toEqual([
    ["C", -2],
    ["B", -2],
  ]);
});

test("buildBumpChartData keeps full weekly top 10 union with null gaps", () => {
  const data = buildBumpChartData([
    snapshot("1", [
      ["A", 100],
      ["B", 90],
      ["C", 80],
      ["D", 70],
      ["E", 60],
      ["F", 50],
      ["G", 40],
      ["H", 30],
      ["I", 20],
      ["J", 10],
    ]),
    snapshot("2", [
      ["A", 110],
      ["B", 100],
      ["C", 90],
      ["D", 80],
      ["E", 70],
      ["F", 60],
      ["G", 50],
      ["H", 40],
      ["I", 30],
      ["K", 20],
    ]),
    snapshot("3", [
      ["A", 120],
      ["B", 110],
      ["C", 100],
      ["D", 90],
      ["E", 80],
      ["F", 70],
      ["G", 60],
      ["K", 50],
      ["L", 40],
      ["M", 30],
    ]),
  ]);

  const ranksFor = (name: string) => data.series.find((series) => series.name === name)?.points.map((point) => point.rank);
  const occupiedRanksByWeek = data.weeks.map((week) =>
    data.series.filter((series) => series.points.find((point) => point.weekKey === week.key)?.rank !== null).length,
  );

  expect(data.series.map((series) => series.name).sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]);
  expect(occupiedRanksByWeek).toEqual([10, 10, 10]);
  expect(ranksFor("J")).toEqual([10, null, null]);
  expect(ranksFor("K")).toEqual([null, 10, 8]);
  expect(ranksFor("M")).toEqual([null, null, 10]);
});


test("buildBumpChartData adds month and readable period metadata", () => {
  const data = buildBumpChartData([
    snapshot("22", [["Rakha", 50]], "25 May 2026 – 31 May 2026"),
    snapshot("23", [["Rakha", 60]], "1 Jun 2026 – 7 Jun 2026"),
    snapshot("24", [["Rakha", 70]], "8 JUN 2026 – 14 JUN 2026"),
  ]);

  expect(data.weeks.map((week) => week.monthLabel)).toEqual(["Mei 2026", "Jun 2026", "Jun 2026"]);
  expect(data.weeks.map((week) => week.periodLabel)).toEqual(["25–31 Mei 2026", "1–7 Jun 2026", "8–14 Jun 2026"]);
  expect(data.weeks.map((week) => week.periodStartLabel)).toEqual(["25 Mei 2026", "1 Jun 2026", "8 Jun 2026"]);
  expect(data.weeks.map((week) => week.periodEndLabel)).toEqual(["31 Mei 2026", "7 Jun 2026", "14 Jun 2026"]);
});
