import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function leaderboardCanvasSource() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/leaderboard/LeaderboardCanvas.tsx"), "utf8");
}

function sourceBetween(start: string, end: string) {
  const source = leaderboardCanvasSource();
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  return source.slice(startIndex, endIndex);
}

test("story export renders podium and table values with the same metric formatter", () => {
  const source = leaderboardCanvasSource();

  expect(source).toMatch(/data-testid="story-value-cell"[\s\S]*formatMetricValue\(athlete\.value, spec\.metric\)/);
});

test("story export uses cinematic compact rows only for one to five athletes", () => {
  const source = sourceBetween("function StoryLeaderboardCanvas", "function LegacyLeaderboardCanvas");

  expect(source).toContain("exportLayoutModeForSpec(spec)");
  expect(source).toMatch(/storyLayoutMode\s*!==\s*"podiumTop10"[\s\S]*<StoryCompactRows spec=\{spec\} \/>/);
  expect(source).toMatch(/<StoryPodium spec=\{spec\} \/>[\s\S]*<StoryTable spec=\{spec\} \/>/);
});

test("story compact rows render equal-height full-bleed athlete rows with formatted values", () => {
  const source = sourceBetween("function StoryCompactRows", "function StoryFooter");

  expect(source).toContain('data-testid="story-compact-rows"');
  expect(source).toContain('data-layout="cinematic-rows"');
  expect(source).toContain('data-row-height="equal"');
  expect(source).toContain('data-stage-anchor="top-10-footer"');
  expect(source).toContain("h-[1180px]");
  expect(source).not.toContain("flex-1");
  expect(source).toMatch(/buildLeaderboardRows\(spec\.athletes,\s*5\)/);
  expect(source).toMatch(/formatMetricDisplayParts\(athlete\.value, spec\.metric\)/);
  expect(source).toContain('data-layer="compact-medal-backplate"');
  expect(source).toMatch(/object-contain[\s\S]*object-center|object-center[\s\S]*object-contain/);
  expect(source).toMatch(/linear-gradient\(to left/);
});

test("story compact row name and value typography stay consistent for top two through five", () => {
  const typographySource = sourceBetween("function compactRowNameClass", "function StoryCompactRows");
  const rowSource = sourceBetween("function StoryCompactRow", "function StoryFooter");

  expect(typographySource).not.toContain("rowCount <= 3");
  expect(typographySource).not.toContain("rowCount >=");
  expect(rowSource).not.toContain("rowCount >= 4");
  expect(rowSource).toContain("formatMetricDisplayParts(athlete.value, spec.metric)");
});

test("story compact rows use full-frame smart crop image treatment", () => {
  const source = sourceBetween("function StoryCompactRow", "function StoryFooter");
  const medalBackplateIndex = source.indexOf('data-layer="compact-medal-backplate"');
  const photoForegroundIndex = source.indexOf('data-image-layer="compact-photo-foreground"');
  const blackFadeIndex = source.indexOf('data-layer="cinematic-row-fade"');

  expect(source).toContain("photoAdjustmentForAthlete(spec, athlete)");
  expect(source).toContain("resolveAthletePodiumImage(athlete, spec)");
  expect(source).toContain("compactCutoutBackdropStyle(athlete.rank)");
  expect(source).toContain("compactPhotoForegroundAdjustmentStyle");
  expect(source).toContain('data-fit-strategy="medal-backplate-foreground"');
  expect(source).toContain("data-fit-strategy");
  expect(source).toContain('data-layer="compact-medal-backplate"');
  expect(source).toContain('data-image-layer="compact-photo-foreground"');
  expect(source).toContain("object-contain");
  expect(source).toContain('data-export-photo-adjust-target="true"');
  expect(source).toContain("data-athlete-id={athlete.id}");
  expect(source).toContain("data-layout-mode={exportLayoutModeForSpec(spec)}");
  expect(medalBackplateIndex).toBeGreaterThanOrEqual(0);
  expect(photoForegroundIndex).toBeGreaterThan(medalBackplateIndex);
  expect(blackFadeIndex).toBeGreaterThan(photoForegroundIndex);
  expect(source).not.toContain('data-image-layer="compact-photo-background"');
  expect(source).not.toContain('data-fit-strategy="dual-layer-background-fill"');
  expect(source).not.toContain("blur-2xl");
  expect(source).not.toContain('data-image-layer="portrait-safe-foreground"');
  expect(source).not.toContain('data-crop="portrait-safe-foreground"');
  expect(source).not.toContain('data-layer="compact-cutout-backdrop"');
  expect(source).not.toContain("left-0 z-[1]");
  expect(source).not.toContain("w-[56%]");
  expect(source).not.toContain("w-[70%]");
});

test("story podium and compact photos prefer sport-specific podium photos before default podium photos", () => {
  const source = leaderboardCanvasSource();

  expect(source).toContain("resolveSportPodiumPhotoUrl");
  expect(source).toMatch(/resolveSportPodiumPhotoUrl\(\{[\s\S]*sportPodiumPhotoUrls: athlete\.sportPodiumPhotoUrls[\s\S]*podiumPhotoUrl: athlete\.podiumPhotoUrl[\s\S]*sportType: spec\.sportType[\s\S]*\}\)/);
});

test("story podium top ten photos can be manually adjusted from export metadata", () => {
  const source = sourceBetween("function StoryAthleteImage", "function StoryPodiumAthlete");
  const podiumSource = sourceBetween("function StoryPodiumAthlete", "function StoryTableAvatar");

  expect(source).toContain("photoAdjustmentForAthlete(spec, athlete)");
  expect(source).toContain("podiumPhotoAdjustmentStyle");
  expect(source).toContain("data-photo-adjustment");
  expect(source).toContain('data-export-photo-adjust-target="true"');
  expect(source).toContain("data-athlete-id={athlete.id}");
  expect(source).toContain("data-layout-mode={exportLayoutModeForSpec(spec)}");
  expect(podiumSource).toContain("<StoryAthleteImage athlete={athlete} spec={spec} />");
});

test("story podium top ten uses medal backplates behind readability gradients", () => {
  const helperSource = sourceBetween("function storyPodiumMedalTone", "function StoryAthleteImage");
  const imageSource = sourceBetween("function StoryAthleteImage", "function StoryPodiumAthlete");
  const podiumSource = sourceBetween("function StoryPodiumAthlete", "function StoryTableAvatar");
  const backplateIndex = podiumSource.indexOf('data-layer="medal-backplate"');
  const athleteImageIndex = podiumSource.indexOf("<StoryAthleteImage athlete={athlete} spec={spec} />");
  const readabilityIndex = podiumSource.indexOf('data-layer="readability-gradient"');

  expect(helperSource).toContain('"gold"');
  expect(helperSource).toContain('"silver"');
  expect(helperSource).toContain('"bronze"');
  expect(imageSource).toContain("absolute inset-0 z-[1] overflow-hidden");
  expect(podiumSource).toContain("storyPodiumMedalTone(athlete.rank)");
  expect(podiumSource).toContain("storyPodiumMedalBackplateStyle(medalTone)");
  expect(podiumSource).toContain("pointer-events-none absolute inset-0 z-0");
  expect(podiumSource).toContain('data-medal-tone={medalTone}');
  expect(podiumSource).toContain('data-layer="medal-backplate"');
  expect(podiumSource).toContain("relative z-20 mt-auto");
  expect(backplateIndex).toBeGreaterThanOrEqual(0);
  expect(athleteImageIndex).toBeGreaterThan(backplateIndex);
  expect(readabilityIndex).toBeGreaterThan(backplateIndex);
  expect(readabilityIndex).toBeGreaterThan(athleteImageIndex);
});

test("story export uses fitted display names without table ellipsis", () => {
  const podiumSource = sourceBetween("function StoryPodiumAthlete", "function StoryTableAvatar");
  const tableSource = sourceBetween("function StoryTable", "function compactRowNameClass");

  expect(podiumSource).toContain('storyDisplayName(athlete.name, "podium")');
  expect(podiumSource).toContain("storyPodiumNameLines(displayName)");
  expect(tableSource).toContain('storyDisplayName(athlete.name, "table")');
  expect(tableSource).not.toContain("truncate font-medium uppercase");
});

test("story weekly total keeps duration values on one line", () => {
  const source = sourceBetween("function StorySummary", "function StoryLeaderboardTitle");

  expect(source).toContain("whitespace-nowrap");
  expect(leaderboardCanvasSource()).toMatch(/function storySummaryNumberClass[\s\S]*\/\\s\/\.test\(number\)/);
});

test("story footer uses a fixed top-10 anchor while compact rows resize inside the ranking stage", () => {
  const source = sourceBetween("function StoryCompactRows", "function StoryLeaderboardCanvas");

  expect(source).toContain('data-stage-anchor="top-10-footer"');
  expect(source).toContain('data-footer-anchor="top-10"');
  expect(source).toContain('data-footer-safe-offset="48"');
});

test("story podium photos use full-bleed smart crop without internal padding or blurred fallback fill", () => {
  const source = sourceBetween("function StoryAthleteImage", "function StoryPodiumAthlete");

  expect(source).toContain('data-fit-strategy="full-bleed-smart-crop"');
  expect(source).toContain('data-crop="full-bleed-smart-crop"');
  expect(source).toContain('data-image-density="adaptive-zoom"');
  expect(source).toContain('data-image-position="center"');
  expect(source).toMatch(/h-full[\s\S]*w-full[\s\S]*object-cover[\s\S]*object-center|object-center[\s\S]*object-cover[\s\S]*w-full[\s\S]*h-full/);
  expect(source).not.toContain("podium-image-fill-${athlete.rank}");
  expect(source).not.toContain("object-contain");
  expect(source).not.toContain("blur-2xl");
});

test("story export includes bottom-right Strava source attribution", () => {
  const source = leaderboardCanvasSource();

  expect(source).toContain("Data from Strava");
  expect(source).toContain("stravaSourceLogoSrc");
  expect(source).toContain('data-source-visibility="enhanced"');
  expect(source).toContain('data-testid="story-source-attribution"');
  expect(source).toMatch(/bottom-\[\d+px\][\s\S]*right-\[58px\]|right-\[58px\][\s\S]*bottom-\[\d+px\]/);
  expect(source).toMatch(/bg-black\/\d+|bg-\[#050505\]/);
});
