import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function athleteDatabaseSource() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/athletes/AthleteDatabaseApp.tsx"), "utf8");
}

test("athlete database page uses one centered database card instead of a permanent side form", () => {
  const source = athleteDatabaseSource();

  expect(source).not.toContain("lg:grid-cols-[420px_1fr]");
  expect(source).not.toContain("<aside");
  expect(source).toContain("max-w-5xl");
  expect(source).toContain("Create Athlete");
  expect(source).toContain("AthleteFormModal");
});

test("create and edit flows open the athlete form modal", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("setFormOpen(true)");
  expect(source).toContain("openCreateModal");
  expect(source).toContain("openEditModal");
  expect(source).toContain('aria-label="Create athlete"');
});

test("image upload opens crop modal and defers Supabase upload until save", () => {
  const source = athleteDatabaseSource();
  const imageSelectionStart = source.indexOf("function handleImageSelection");
  const saveStart = source.indexOf("async function handleSave");
  const saveEnd = source.indexOf("async function handleDelete", saveStart);

  expect(source).toContain("CropImageModal");
  expect(source).toContain("pendingProfileFile");
  expect(source).toContain("pendingPodiumFile");
  expect(imageSelectionStart).toBeGreaterThan(-1);
  expect(saveStart).toBeGreaterThan(-1);

  const selectionBlock = source.slice(imageSelectionStart, saveStart);
  const saveBlock = source.slice(saveStart, saveEnd);

  expect(selectionBlock).not.toContain("uploadAthleteImage(");
  expect(saveBlock).toContain('uploadAthleteImage(form.pendingProfileFile, "athlete-profile")');
  expect(saveBlock).toContain('uploadAthleteImage(form.pendingPodiumFile, "athlete-podium")');
  expect(saveBlock).toContain("form.pendingSportPodiumFiles[option.key]");
  expect(saveBlock).toContain('uploadAthleteImage(file, "athlete-podium")');
});

test("athlete save flow shows a toast for success and failure", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("interface AthleteToast");
  expect(source).toContain("const [toast, setToast]");
  expect(source).toContain("function showToast");
  expect(source).toContain('data-testid="athlete-save-toast"');
  expect(source).toContain('role="status"');
  expect(source).toContain('showToast("Atlet berhasil disimpan", "success")');
  expect(source).toContain('showToast(`Gagal menyimpan atlet: ${message}`, "error")');
});

test("athlete database rows use a hybrid list with expandable photo details", () => {
  const source = athleteDatabaseSource();
  const listStart = source.indexOf('data-testid="athlete-database-list"');
  const listBlock = source.slice(listStart);

  expect(source).toContain("expandedAthleteId");
  expect(source).toContain("AthletePhotoSummary");
  expect(source).toContain("AthleteDetailDrawer");
  expect(source).toContain("photoCoverageForAthlete");
  expect(source).toContain("SPORT_PODIUM_PHOTO_OPTIONS");
  expect(source).toContain('data-testid="athlete-detail-drawer"');
  expect(source).toContain('aria-label={`Expand ${athlete.name} photo details`}');
  expect(source).toContain('aria-label={`Collapse ${athlete.name} photo details`}');
  expect(listBlock).not.toContain("grid-cols-[64px_minmax(180px,1fr)_420px_96px]");
  expect(listBlock).not.toContain("<span>Photos</span>");
  expect(listBlock).not.toContain("<span>Download</span>");
  expect(listBlock).not.toContain("handleDownloadPhoto");
  expect(source).not.toContain("max-w-14 truncate");
});

test("athlete detail drawer previews photos and opens the existing edit modal", () => {
  const source = athleteDatabaseSource();
  const drawerStart = source.indexOf("function AthleteDetailDrawer");
  const drawerEnd = source.indexOf("function ImportAthleteModal", drawerStart);
  const drawerBlock = source.slice(drawerStart, drawerEnd);

  expect(drawerStart).toBeGreaterThan(-1);
  expect(drawerBlock).toContain("Manage Photos");
  expect(drawerBlock).toContain("onManage");
  expect(drawerBlock).toContain("Main podium");
  expect(drawerBlock).toContain("Custom");
  expect(drawerBlock).toContain("Default");
  expect(source).toContain("onManage={() => openEditModal(athlete)}");
});

test("athlete edit modal keeps photo download and delete actions on each photo card", () => {
  const source = athleteDatabaseSource();
  const modalStart = source.indexOf("function AthleteFormModal");
  const modalEnd = source.indexOf("function CropImageModal", modalStart);
  const modalBlock = source.slice(modalStart, modalEnd);

  expect(source).toContain("PhotoActionCard");
  expect(source).toContain("handleClearPhoto");
  expect(source).toContain("handleClearSportPodiumPhoto");
  expect(source).toContain('aria-label={`${title} download`}');
  expect(source).toContain('aria-label={`${title} delete`}');
  expect(source).toContain("<Download");
  expect(source).toContain("<Trash2");
  expect(modalBlock).not.toContain("Fallback");
  expect(modalBlock).not.toContain("podium URL");
  expect(modalBlock).not.toContain("Profile photo URL");
});

test("initial athlete database load is scheduled directly from the effect", () => {
  const source = athleteDatabaseSource();
  const effectStart = source.indexOf("void refreshStorageStatus()");
  const effectBlock = source.slice(Math.max(0, effectStart - 160), effectStart + 180);

  expect(effectBlock).toContain("void refreshStorageStatus()");
  expect(effectBlock).toContain('void refreshAthletes("")');
  expect(effectBlock).not.toContain("queueMicrotask");
});
