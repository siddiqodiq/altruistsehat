import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("public leaderboard exposes clickable athlete profile popovers from chart and table", () => {
  const ui = source("src/components/leaderboard/LeaderboardUi.tsx");

  expect(ui).toContain("AthleteProfilePopover");
  expect(ui).toContain('data-testid="leaderboard-athlete-popover"');
  expect(ui).toContain("publicProfileHref");
  expect(ui).toContain("onAthleteOpen");
  expect(ui).toContain("handleAthleteKeyDown");
  expect(ui).toContain('tabIndex={0}');
  expect(ui).toContain('role="button"');
  expect(ui).toContain('role="group"');
  expect(ui).toContain("focusChartAthlete(series.key);");
  expect(ui).toContain("showTooltip(series, point);");
  expect(ui).toContain("clearChartAthleteFocus();");
  expect(ui).toContain("setTooltip(null);");
  expect(ui).toContain('aria-label={`Buka profil ${athlete.name}`}');
  expect(ui).toContain('aria-label={`Buka detail profil ${series.name}`}');
  expect(ui).toContain('data-testid="leaderboard-chart-profile-tooltip"');
  expect(ui).toContain("pointer-events-auto");
  expect(ui).toContain('alt={`${tooltip.series.name} profile`}');
  expect(ui).toContain("const tooltipAthlete = profileAthleteFromSeries(tooltip.series)");
  expect(ui).toContain("publicProfileHref(tooltipAthlete)");
  expect(ui).toContain("Lihat profil");
  expect(ui).not.toContain("Top 10");
  expect(ui).not.toContain("hover pada titik ranking");
});

test("public bump chart renders photo-only latest endpoint markers with compact hovercard", () => {
  const ui = source("src/components/leaderboard/LeaderboardUi.tsx");

  expect(ui).toContain("const latestWeekKey = data.weeks.at(-1)?.key");
  expect(ui).toContain("point.weekKey === latestWeekKey");
  expect(ui).toContain('data-testid={`leaderboard-endpoint-avatar-${series.key}`}');
  expect(ui).toContain("resolveUsableAthletePhotoUrl(series.profilePhotoUrl)");
  expect(ui).toContain("initialsForName(series.name)");
  expect(ui).toContain("rankMovementTooltip(tooltip.previousRank, tooltip.point.rank)");
  expect(ui).toContain("w-[260px]");
  expect(ui).toContain("const tooltipWidth = 260");
  expect(ui).not.toContain("const shouldShowLabel");
  expect(ui).not.toContain("{trendLabel(series.name)} {rankChangeLabel(series.rankDelta)}");
  expect(ui).not.toContain("grid grid-cols-3 gap-2");
});

test("public leaderboard has an explicit chart range filter with one-month copy by default", () => {
  const page = source("src/components/leaderboard/LeaderboardPublicPage.tsx");
  const ui = source("src/components/leaderboard/LeaderboardUi.tsx");

  expect(page).toContain("DEFAULT_CHART_RANGE_WEEKS = 4");
  expect(page).toContain("CHART_RANGE_OPTIONS");
  expect(page).toContain('label: "1 Bulan"');
  expect(page).toContain('label: "2 Bulan"');
  expect(page).toContain('value: "all"');
  expect(page).toContain("chartRangeWeeks");
  expect(page).toContain("chartRangeLabel");
  expect(page).toContain("1 Bulan Terakhir");
  expect(page).toContain("2 Bulan Terakhir");
  expect(page).not.toContain('"8 Minggu"');
  expect(page).not.toContain("8 Minggu Terakhir");
  expect(page).toContain("chartSnapshotsForRange");
  expect(page).toContain('aria-label="Filter rentang chart leaderboard"');
  expect(page).toContain('lookupAthletesByName(names, { forceRefresh: true })');
  expect(page).toContain("rangeLabel={chartRangeLabel}");
  expect(ui).toContain("rangeLabel");
  expect(ui).toContain("chartDataFromSnapshots(snapshots: LeaderboardWeekSnapshot[], maxWeeks = 4)");
  expect(ui).toContain("buildBumpChartData(snapshots, { maxWeeks })");
});

test("public athlete profile route is server-rendered and uses username lookup", () => {
  const page = source("src/app/atlet/[username]/page.tsx");

  expect(page).toContain("loadPublicAthleteProfileByUsername");
  expect(page).toContain('params: Promise<{ username: string }>');
  expect(page).toContain("notFound()");
  expect(page).toContain("Profil Atlet");
  expect(page).toContain("Data Mileage");
  expect(page).not.toContain("authUserId");
});
