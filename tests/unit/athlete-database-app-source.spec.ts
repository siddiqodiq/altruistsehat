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

test("athlete database rows expose stored photo download actions", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("downloadAthletePhoto");
  expect(source).toContain("handleDownloadPhoto");
  expect(source).toContain('aria-label={`Download ${athlete.name} profile photo`}');
  expect(source).toContain('aria-label={`Download ${athlete.name} podium photo`}');
  expect(source).toContain("disabled={!athlete.profilePhotoUrl}");
  expect(source).toContain("disabled={!athlete.podiumPhotoUrl}");
  expect(source).toContain("<Download");
  expect(source).toContain("<span>Download</span>");
});

test("initial athlete database load is scheduled directly from the effect", () => {
  const source = athleteDatabaseSource();
  const effectStart = source.indexOf("void refreshStorageStatus()");
  const effectBlock = source.slice(Math.max(0, effectStart - 160), effectStart + 180);

  expect(effectBlock).toContain("void refreshStorageStatus()");
  expect(effectBlock).toContain('void refreshAthletes("")');
  expect(effectBlock).not.toContain("queueMicrotask");
});
