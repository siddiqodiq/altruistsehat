import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function source(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

test("admin export preview wires the athlete count picker into preview and download specs", () => {
  const adminSource = source("src/components/leaderboard/LeaderboardAdminManager.tsx");
  const uiSource = source("src/components/leaderboard/LeaderboardUi.tsx");

  expect(adminSource).toContain("exportAthleteSelection");
  expect(adminSource).toContain("exportPhotoAdjustments");
  expect(adminSource).toContain("specWithExportAthleteSelection");
  expect(adminSource).toContain("exportAthleteSelectionOptions");
  expect(adminSource).toMatch(/<ExportPreviewModal[\s\S]*exportAthleteSelection=\{exportAthleteSelection\}/);
  expect(adminSource).toMatch(/specWithExportAthleteSelection\([\s\S]*exportPhotoAdjustments[\s\S]*exportAthleteSelection\)/);

  expect(uiSource).toContain('data-testid="export-athlete-picker"');
  expect(uiSource).toContain('data-testid="export-photo-adjust-panel"');
  expect(uiSource).toContain('data-testid="export-photo-adjust-athletes"');
  expect(uiSource).toContain("Zoom");
  expect(uiSource).toContain("Horizontal");
  expect(uiSource).toContain("Vertical");
  expect(uiSource).toContain("isCompactExportLayoutMode");
  expect(uiSource).toContain("compactZoomMin = 0.8");
  expect(uiSource).toContain("isCompactExportLayoutMode(layoutMode) ? compactZoomMin : 1");
  expect(uiSource).toContain("Math.max(zoomMin, selectedAdjustment.zoom)");
  expect(uiSource).toContain("min={zoomMin}");
  expect(uiSource).toContain("exportAthleteSelectionOptions");
  expect(uiSource).toContain("onExportAthleteSelectionChange");
  expect(uiSource).toContain("onExportPhotoAdjustmentChange");
  expect(adminSource).toContain("handleSaveSelectedExportPhotoAdjustment");
  expect(adminSource).toContain("handleSaveAdjustedExportPhotoAdjustments");
  expect(adminSource).toContain("updateAthletePhotoAdjustments");
  expect(adminSource).toContain("clearAthleteLookupCache");
  expect(uiSource).toContain("Save as Default");
  expect(uiSource).toContain("Save Adjusted");
  expect(uiSource).toContain("onSaveSelectedPhotoAdjustment");
  expect(uiSource).toContain("onSaveAdjustedPhotoAdjustments");
  expect(uiSource).toContain("savingPhotoAdjustment");
});

test("PNG export captures the preview frame in the browser at full output resolution", () => {
  const imageSource = source("src/lib/leaderboard/export-image.ts");

  expect(imageSource).toContain("[data-export-frame]");
  // A scaled preview wrapper must not shrink the PNG, and the DPR must not enlarge it.
  expect(imageSource).toContain("OUTPUT_DIMENSIONS[format]");
  expect(imageSource).toContain("pixelRatio: 1");
  expect(imageSource).toContain('transform: "none"');
  expect(imageSource).toContain("waitForFrameAssets");
});

test("export preview blocks download while athlete photos load and guides a refresh on failure", () => {
  const adminSource = source("src/components/leaderboard/LeaderboardAdminManager.tsx");
  const uiSource = source("src/components/leaderboard/LeaderboardUi.tsx");

  // A failed athlete lookup must not surface a raw "TypeError: fetch failed".
  expect(adminSource).toContain("ATHLETE_PHOTO_FETCH_ERROR");
  expect(adminSource).toContain("setExportPhotosLoading");
  expect(adminSource).toMatch(/if \(exportPhotosLoading\) \{\s*return;/);

  expect(uiSource).toContain("usePreviewPhotosLoading");
  expect(uiSource).toContain("export-preview-loading");
  expect(uiSource).toContain("Refresh halaman");
  expect(uiSource).toContain("window.location.reload()");
  expect(uiSource).toContain("disabled={exporting || previewLoading}");
});

test("PNG export no longer depends on a server-side headless browser", () => {
  const clientSource = source("src/lib/leaderboard/export-client.ts");

  expect(clientSource).not.toContain("/api/export");
  expect(clientSource).toContain("downloadExportFrame");

  for (const componentPath of [
    "src/components/leaderboard/GeneratorApp.tsx",
    "src/components/leaderboard/LeaderboardDashboard.tsx",
    "src/components/leaderboard/LeaderboardAdminManager.tsx",
  ]) {
    expect(source(componentPath)).not.toContain("/api/export");
  }
});
