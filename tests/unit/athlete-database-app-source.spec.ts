import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function athleteDatabaseSource() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/athletes/AthleteDatabaseApp.tsx"), "utf8");
}

test("admin anggota page uses domain copy instead of database dashboard language", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("Kelola data anggota dan akses akun komunitas.");
  expect(source).toContain("Tambah anggota");
  expect(source).toContain("Cari nama atau username");
  expect(source).toContain("Import anggota");
  expect(source).not.toContain("Athlete Database");
  expect(source).not.toContain("Create Athlete");
  expect(source).not.toContain("Search athlete");
  expect(source).not.toContain("normalized_name:");
  expect(source).not.toContain("Storage ready");
  expect(source).not.toContain("Storage initialized");
  expect(source).not.toContain("Photo coverage");
  expect(source).not.toContain("No photos");
});

test("admin anggota page mirrors the kegiatan admin panel surface style", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain('import { Button } from "@/components/ui/Button";');
  expect(source).toContain('import { Input } from "@/components/ui/Input";');
  expect(source).toContain('className={cn("grid w-full min-w-0 gap-5", embedded ? "" : "min-h-screen content-start")}');
  expect(source).toContain("rounded-[1.35rem] border border-secondary-sand/60 bg-white p-5 shadow-[0_14px_34px_rgb(90,46,23,0.06)] dark:border-zinc-800 dark:bg-zinc-900");
  expect(source).toContain("border-b border-secondary-sand/60 pb-5 dark:border-zinc-800 md:flex-row md:items-center md:justify-between");
  expect(source).toContain("Direktori Komunitas");
  expect(source).toContain("<Button aria-label=\"Tambah anggota\" onClick={openCreateModal}>");
  expect(source).toContain('<Button onClick={() => setImportOpen(true)} variant="secondary">');
  expect(source).toContain("<Input");
});

test("member list is optimized for scanning and keeps secondary actions in a menu", () => {
  const source = athleteDatabaseSource();
  const listStart = source.indexOf('data-testid="athlete-database-list"');
  const listBlock = source.slice(listStart);

  expect(source).toContain("selectedAthlete");
  expect(source).toContain("openMenuAthleteId");
  expect(source).toContain('data-testid="member-list-row"');
  expect(source).toContain('aria-label={`Menu ${athlete.name}`}');
  expect(source).toContain("Lihat profil");
  expect(source).toContain("Edit anggota");
  expect(source).toContain("Kelola akun");
  expect(source).toContain("Kelola foto");
  expect(source).toContain("Hapus anggota");
  expect(source).not.toContain("expandedAthleteId");
  expect(source).not.toContain("ChevronDown");
  expect(source).not.toContain("ChevronUp");
  expect(listBlock).not.toContain("AthletePhotoSummary");
});

test("detail drawer separates profile, photo, and account actions", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("function MemberDetailDrawer");
  expect(source).toContain('data-testid="member-detail-drawer"');
  expect(source).toContain("Data anggota");
  expect(source).toContain("Foto anggota");
  expect(source).toContain("Akun & akses");
  expect(source).toContain("onManageAccount");
  expect(source).toContain("onManagePhotos");
  expect(source).not.toContain('data-testid="athlete-detail-drawer"');
});

test("account management supports username update and password reset without reading old password", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("function AccountManagementModal");
  expect(source).toContain("listAthleteRoles");
  expect(source).toContain("updateAthleteRole");
  expect(source).toContain("updateAthleteAccount");
  expect(source).toContain("resetAthletePassword");
  expect(source).toContain("Username digunakan untuk masuk ke akun anggota.");
  expect(source).toContain("Password saat ini tidak dapat dilihat oleh admin.");
  expect(source).toContain("Akun anggota belum siap dipakai.");
  expect(source).toContain("Atur ulang password");
  expect(source).toContain("onRoleChange");
  expect(source).toContain("Simpan peran akun");
  expect(source).toContain("function PasswordResetConfirmationDialog");
  expect(source).toContain("Password berhasil diubah.");
  expect(source).not.toContain("Akun anggota belum terhubung Auth.");
  expect(source).not.toContain("Akun Auth atlet tidak ditemukan.");
  expect(source).not.toContain('href="/admin?tab=roles"');
  expect(source).not.toContain("Buka Peran");
  expect(source).not.toContain("Show password");
  expect(source).not.toContain("password lama");
  expect(source).not.toContain("localStorage");
  expect(source).not.toContain("sessionStorage");
});

test("delete member uses an Indonesian confirmation dialog instead of window confirm", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("function DeleteMemberDialog");
  expect(source).toContain("Hapus anggota?");
  expect(source).toContain("Profil dan akses anggota ini akan dilepas dari komunitas.");
  expect(source).toContain("deleteTarget");
  expect(source).not.toContain("sesuai aturan sistem");
  expect(source).not.toContain("window.confirm");
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

test("photo save errors surface actionable upload and session messages", () => {
  const source = athleteDatabaseSource();

  expect(source).toContain("Sesi admin berakhir. Silakan login ulang.");
  expect(source).toContain("Akses admin diperlukan untuk menyimpan perubahan.");
  expect(source).toContain("Foto harus berupa PNG, JPEG, atau WebP.");
  expect(source).toContain("Ukuran foto terlalu besar setelah dipotong.");
});
