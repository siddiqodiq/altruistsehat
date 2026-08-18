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
  expect(uiSource).toContain("EXPORT_PHOTO_ADJUSTMENT_LIMITS");
  expect(uiSource).toContain("EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMin");
  expect(uiSource).toContain("EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMax");
  expect(uiSource).toContain("EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMax");
  expect(uiSource).not.toContain("compactZoomMin = 0.8");
  expect(uiSource).toContain("handleExportPreviewPointerDown");
  expect(uiSource).toContain("handleExportPreviewPointerMove");
  expect(uiSource).toContain("handleExportPreviewPointerUp");
  expect(uiSource).toContain("handleExportPreviewWheel");
  expect(uiSource).toContain("setPointerCapture");
  expect(uiSource).toContain("previewScale");
  expect(uiSource).toContain('data-testid="export-photo-direct-editor"');
  expect(uiSource).toContain('aria-label="Perbesar foto terpilih"');
  expect(uiSource).toContain('aria-label="Perkecil foto terpilih"');
  expect(uiSource).not.toContain('max="2.2"');
  expect(uiSource).not.toContain('max="40"');
  expect(uiSource).not.toContain("type=\"range\"");
  expect(uiSource).not.toContain(">Zoom<");
  expect(uiSource).not.toContain(">Horizontal<");
  expect(uiSource).not.toContain(">Vertical<");
  expect(uiSource).toContain("exportAthleteSelectionOptions");
  expect(uiSource).toContain("onExportAthleteSelectionChange");
  expect(uiSource).toContain("onExportPhotoAdjustmentChange");
  expect(adminSource).toContain("scheduleExportPhotoAdjustmentAutosave");
  expect(adminSource).toContain("flushPendingExportPhotoAdjustmentAutosaves");
  expect(adminSource).toContain("updateAthletePhotoAdjustments");
  expect(adminSource).toContain("clearAthleteLookupCache");
  expect(adminSource).toContain("forceRefresh: true");
  expect(uiSource).not.toContain("Save as Default");
  expect(uiSource).not.toContain("Save Adjusted");
  expect(uiSource).not.toContain("onSaveSelectedPhotoAdjustment");
  expect(uiSource).not.toContain("onSaveAdjustedPhotoAdjustments");
  expect(uiSource).not.toContain("savingPhotoAdjustment");
  expect(adminSource).toContain("refreshingExportPreview");
  expect(adminSource).toContain("handleRefreshExportPreview");
  expect(adminSource).toMatch(/<ExportPreviewModal[\s\S]*onRefresh=\{\(\) => void handleRefreshExportPreview\(\)\}/);
  expect(uiSource).toContain("onRefresh");
  expect(uiSource).toContain("refreshingExportPreview");
  expect(uiSource).toContain('aria-label="Muat ulang pratinjau"');
  expect(uiSource).not.toContain("Refresh Export");
  expect(uiSource).toContain('data-testid="export-preview-stage"');
  expect(uiSource).toContain("grid place-items-center overflow-auto");
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

  for (const componentPath of ["src/components/leaderboard/LeaderboardAdminManager.tsx"]) {
    expect(source(componentPath)).not.toContain("/api/export");
  }
});
