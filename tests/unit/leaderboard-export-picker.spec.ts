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
  expect(uiSource).toContain("isCompactExportLayoutMode");
  expect(uiSource).toContain("compactZoomMin = 0.8");
  expect(uiSource).toContain("isCompactExportLayoutMode(layoutMode) ? compactZoomMin : 1");
  expect(uiSource).toContain("Math.max(zoomMin, selectedAdjustment.zoom)");
  expect(uiSource).toContain("handleExportPreviewPointerDown");
  expect(uiSource).toContain("handleExportPreviewPointerMove");
  expect(uiSource).toContain("handleExportPreviewPointerUp");
  expect(uiSource).toContain("handleExportPreviewWheel");
  expect(uiSource).toContain("setPointerCapture");
  expect(uiSource).toContain("previewScale");
  expect(uiSource).toContain('data-testid="export-photo-direct-editor"');
  expect(uiSource).toContain('aria-label="Zoom in selected photo"');
  expect(uiSource).toContain('aria-label="Zoom out selected photo"');
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
  expect(uiSource).toContain('aria-label="Refresh export"');
  expect(uiSource).not.toContain("Refresh Export");
  expect(uiSource).toContain('data-testid="export-preview-stage"');
  expect(uiSource).toContain("grid place-items-center overflow-auto");
});

test("PNG export route hides Next dev indicator overlays before taking the frame screenshot", () => {
  const routeSource = source("src/app/api/export/route.ts");

  expect(routeSource).toContain("NEXT_DEVTOOLS_HIDE_CSS");
  expect(routeSource).toContain("nextjs-portal");
  expect(routeSource).toContain("[data-nextjs");
  expect(routeSource).toContain("page.addStyleTag");
  expect(routeSource).toMatch(/hideNextDevIndicators\(page\)[\s\S]*waitForSelector\("\[data-export-frame\]"[\s\S]*frame\.screenshot/);
});

test("PNG export route uses Vercel-compatible Chromium instead of bundled Playwright", () => {
  const packageJson = JSON.parse(source("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const routeSource = source("src/app/api/export/route.ts");
  const nextConfigSource = source("next.config.mjs");

  expect(packageJson.dependencies).toHaveProperty("@sparticuz/chromium-min");
  expect(packageJson.dependencies).toHaveProperty("puppeteer-core");
  expect(packageJson.dependencies).not.toHaveProperty("playwright");
  expect(packageJson.devDependencies).toHaveProperty("@playwright/test");
  expect(routeSource).toContain('from "puppeteer-core"');
  expect(routeSource).toContain('@sparticuz/chromium-min');
  expect(routeSource).toContain("process.env.VERCEL");
  expect(routeSource).not.toContain('from "playwright"');
  expect(nextConfigSource).not.toContain('serverExternalPackages: ["playwright"]');
});

test("admin export download keeps preview adjustments stable while rendering", () => {
  const adminSource = source("src/components/leaderboard/LeaderboardAdminManager.tsx");
  const openStart = adminSource.indexOf("async function openExportPreview()");
  const downloadStart = adminSource.indexOf("async function handleDownloadExport()");
  const tableActionsStart = adminSource.indexOf("const tableActions", downloadStart);

  expect(openStart).toBeGreaterThan(-1);
  expect(downloadStart).toBeGreaterThan(-1);
  expect(tableActionsStart).toBeGreaterThan(downloadStart);

  const openBlock = adminSource.slice(openStart, downloadStart);
  const downloadBlock = adminSource.slice(downloadStart, tableActionsStart);

  expect(openBlock).not.toContain("setExportPhotoAdjustments({})");
  expect(downloadBlock).toContain("flushPendingExportPhotoAdjustmentAutosaves()");
  expect(downloadBlock).toContain("specWithLatestDatabasePhotos(selectedExportSpec)");
  expect(downloadBlock).toContain("downloadLeaderboardPng(exportSpecToDownload");
  expect(downloadBlock).not.toContain("setExportPreviewSpec(latestPhotoSpec)");
});
