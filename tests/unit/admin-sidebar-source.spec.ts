import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("admin hub uses sidebar and mobile drawer navigation instead of floating tabs", () => {
  const adminHub = source("src/components/admin/AdminHub.tsx");
  const navbar = source("src/components/NavbarClient.tsx");

  expect(navbar).toContain("GlobalAdminSidebar");
  expect(navbar).toContain("AdminSidebarNav");
  expect(navbar).toContain("admin-hover-sidebar");
  expect(navbar).toContain("admin-mobile-sidebar-trigger");
  expect(navbar).toContain("normalizeAdminTab");
  expect(navbar).not.toContain("pathname.startsWith(\"/admin\")");
  expect(adminHub).not.toContain("lg:sticky lg:top-0 lg:block lg:h-screen");
  expect(adminHub).not.toContain("admin-mobile-drawer");
  expect(adminHub).not.toContain("setMobileNavOpen");
  expect(adminHub).not.toContain("Admin Area");
  expect(adminHub).not.toContain("Control Center");
  expect(navbar).not.toContain("Admin Area");
  expect(navbar).not.toContain("Control Center");
  expect(adminHub).not.toContain("fixed left-4 right-4 top-20");
  expect(adminHub).not.toContain("justify-center rounded-full border border-secondary-sand/70");
});

test("role management is folded into anggota instead of a separate admin route", () => {
  const adminHub = source("src/components/admin/AdminHub.tsx");
  const adminNavigation = source("src/components/admin/AdminNavigation.tsx");

  expect(adminNavigation).not.toContain('id: "roles"');
  expect(adminNavigation).not.toContain('label: "Peran"');
  expect(adminNavigation).toContain('value === "roles"');
  expect(adminNavigation).toContain('return "athletes"');
  expect(adminHub).not.toContain("RoleManagementPanel");
  expect(adminHub).not.toContain('activeTab === "roles"');
});

test("global admin sidebar avoids window-only active tab markup during hydration", () => {
  const navbar = source("src/components/NavbarClient.tsx");

  expect(navbar).toContain("const [activeAdminTab, setActiveAdminTab] = useState<AdminTab | undefined>(undefined)");
  expect(navbar).toContain('setActiveAdminTab(isAdminPath ? normalizeAdminTab(new URLSearchParams(window.location.search).get("tab")) : undefined)');
  expect(navbar).not.toContain('typeof window !== "undefined"');
  expect(navbar).not.toContain('const activeAdminTab =\n    isAdminPath &&');
});

test("leaderboard admin exposes import as a modal and removes legacy status badges", () => {
  const adminManager = source("src/components/leaderboard/LeaderboardAdminManager.tsx");

  expect(adminManager).toContain("ImportDataModal");
  expect(adminManager).toContain("setImportOpen");
  expect(adminManager).toContain('label="Masukkan data"');
  expect(adminManager).not.toContain("<ImportDataCard");
  expect(adminManager).not.toContain("Admin aktif");
  expect(adminManager).not.toContain("Admin belum aktif");
});

test("leaderboard admin uses compact controls with a progressive week picker modal", () => {
  const adminManager = source("src/components/leaderboard/LeaderboardAdminManager.tsx");
  const adminControlsStart = adminManager.indexOf("function AdminControls");
  const weekPickerStart = adminManager.indexOf("function WeekPickerModal");
  const adminControls = adminManager.slice(adminControlsStart, weekPickerStart);
  const weekPickerEnd = adminManager.indexOf("function ImportDataModal", weekPickerStart);
  const weekPicker = adminManager.slice(weekPickerStart, weekPickerEnd);

  expect(adminManager).toContain("WeekPickerModal");
  expect(adminManager).toContain("controlFieldClassName");
  expect(adminControls).toContain("setWeekPickerOpen(true)");
  expect(adminControls).toContain("Periode");
  expect(adminManager).toContain("Pilih olahraga");
  expect(adminManager).toContain("Pilih ukuran");
  expect(adminManager).toContain("metricOptionsForSport");
  expect(adminManager).toContain("categoryForSportMetric");
  expect(adminManager).toContain("<select");
  expect(adminControls).not.toContain("calendar.days.map");
  expect(adminControls).not.toContain("weekdayLabels.map");
  expect(adminControls).not.toContain("setHoveredWeekValue");
  expect(weekPicker).toContain("Pilih minggu");
  expect(weekPicker).toContain("Terapkan");
  expect(weekPicker).toContain("pendingWeekValue");
  expect(weekPicker).toContain("function WeekRow");
  expect(weekPicker).toContain("calendar.weekRows.map");
  expect(weekPicker).toContain("Pilih minggu ${week.compactWeekRange}");
  expect(weekPicker).not.toContain("Pilih Periode Mingguan");
  expect(weekPicker).not.toContain("Pilih Periode");
  expect(weekPicker).not.toContain("calendar.days.map");
  expect(weekPicker).not.toContain("Pilih ${day.dateIso}");
  expect(adminManager).not.toContain("Viewing");
  expect(adminManager).not.toContain("context.athletes");
});

test("leaderboard admin keeps destructive delete less visually dominant than primary actions", () => {
  const adminManager = source("src/components/leaderboard/LeaderboardAdminManager.tsx");
  const tableActionsStart = adminManager.indexOf("const tableActions");
  const tableActionsEnd = adminManager.indexOf("const pendingViewRange", tableActionsStart);
  const tableActions = adminManager.slice(tableActionsStart, tableActionsEnd);

  expect(tableActions).toContain("Bersihkan minggu");
  expect(tableActions).toContain("h-9");
  expect(tableActions).not.toContain("bg-red-50");
  expect(tableActions).not.toContain("border-red-200");
});

test("leaderboard admin uses friendly Indonesian labels instead of technical action copy", () => {
  const adminManager = source("src/components/leaderboard/LeaderboardAdminManager.tsx");

  expect(adminManager).toContain("Musim");
  expect(adminManager).toContain("Ukuran");
  expect(adminManager).toContain("Peringkat");
  expect(adminManager).toContain("Anggota");
  expect(adminManager).toContain("Hasil");
  expect(adminManager).toContain("Naik-turun");
  expect(adminManager).toContain("Aksi");
  expect(adminManager).toContain("Masukkan data");
  expect(adminManager).toContain("Unduh gambar");
  expect(adminManager).toContain("Tambah anggota");
  expect(adminManager).toContain("Buang");
  expect(adminManager).toContain("Simpan");
  expect(adminManager).not.toContain("Save Changes");
  expect(adminManager).not.toContain("Discard Changes");
  expect(adminManager).not.toContain("Delete Week");
  expect(adminManager).not.toContain("Unknown error");
  expect(adminManager).not.toContain("Rendering PNG");
  expect(adminManager).not.toContain("Save failed");
});

test("leaderboard admin normalizes category drafts before switching metric views", () => {
  const adminManager = source("src/components/leaderboard/LeaderboardAdminManager.tsx");

  expect(adminManager).toContain("ensureCategoryDrafts");
  expect(adminManager).toContain("useState<Record<LeaderboardCategoryId, LeaderboardProjectState>>(() => ensureCategoryDrafts())");
  expect(adminManager).toContain("setDraftsByCategory((current) => ensureCategoryDrafts(current));");
  expect(adminManager).toContain("const sourceDraft = draftsByCategory[target.category] ?? createCategoryDraft(target.category);");
  expect(adminManager).not.toContain("const sourceDraft = draftsByCategory[target.category];");
});
