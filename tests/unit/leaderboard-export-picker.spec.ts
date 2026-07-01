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

test("PNG export route hides Next dev indicator overlays before taking the frame screenshot", () => {
  const routeSource = source("src/app/api/export/route.ts");

  expect(routeSource).toContain("NEXT_DEVTOOLS_HIDE_CSS");
  expect(routeSource).toContain("nextjs-portal");
  expect(routeSource).toContain("[data-nextjs");
  expect(routeSource).toContain("page.addStyleTag");
  expect(routeSource).toMatch(/hideNextDevIndicators\(page\)[\s\S]*page\.locator\("\[data-export-frame\]"\)\.screenshot/);
});
