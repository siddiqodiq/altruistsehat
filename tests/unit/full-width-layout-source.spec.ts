import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fluidGutter = "w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12";

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const shellFiles = [
  "src/components/NavbarClient.tsx",
  "src/components/Hero.tsx",
  "src/components/ValueProposition.tsx",
  "src/components/Features.tsx",
  "src/components/LifestyleGallery.tsx",
  "src/components/Timeline.tsx",
  "src/components/CTA.tsx",
  "src/components/Footer.tsx",
  "src/components/activities/ActivitiesPage.tsx",
  "src/components/admin/AdminHub.tsx",
  "src/components/leaderboard/LeaderboardUi.tsx",
  "src/components/leaderboard/LeaderboardPublicPage.tsx",
  "src/components/leaderboard/LeaderboardAdminManager.tsx",
] as const;

const topbarClearanceFiles = [
  "src/components/activities/ActivitiesPage.tsx",
  "src/components/activities/ActivityDetailPage.tsx",
  "src/components/admin/AdminHub.tsx",
  "src/components/leaderboard/LeaderboardAdminManager.tsx",
  "src/components/leaderboard/LeaderboardUi.tsx",
  "src/components/profile/ProfilePageClient.tsx",
  "src/components/auth/LoginForm.tsx",
] as const;

test("page and section shells use fluid full-width gutters", () => {
  for (const file of shellFiles) {
    expect(source(file), file).toContain(fluidGutter);
  }
});

test("page and section shells no longer use centered max-width containers", () => {
  const forbiddenShellPatterns = [
    ["src/components/NavbarClient.tsx", "mx-auto max-w-7xl"],
    ["src/components/Hero.tsx", "max-w-7xl mx-auto"],
    ["src/components/ValueProposition.tsx", "max-w-7xl mx-auto"],
    ["src/components/Features.tsx", "max-w-7xl mx-auto"],
    ["src/components/LifestyleGallery.tsx", "max-w-7xl mx-auto"],
    ["src/components/Timeline.tsx", "max-w-7xl mx-auto"],
    ["src/components/CTA.tsx", "max-w-4xl mx-auto"],
    ["src/components/Footer.tsx", "max-w-7xl mx-auto"],
    ["src/components/activities/ActivitiesPage.tsx", "mx-auto w-full max-w-7xl"],
    ["src/components/admin/AdminHub.tsx", "mx-auto w-full max-w-7xl"],
    ["src/components/leaderboard/LeaderboardUi.tsx", "mx-auto grid max-w-[1600px]"],
    ["src/components/leaderboard/LeaderboardPublicPage.tsx", "mx-auto w-full max-w-[1600px]"],
    ["src/components/leaderboard/LeaderboardAdminManager.tsx", "mx-auto grid min-w-0 w-full max-w-[1600px]"],
    ["src/components/athletes/AthleteDatabaseApp.tsx", "mx-auto grid w-full min-w-0 max-w-5xl"],
  ] as const;

  for (const [file, pattern] of forbiddenShellPatterns) {
    expect(source(file), `${file} should not contain ${pattern}`).not.toContain(pattern);
  }
});

test("fixed topbar pages reserve shared clearance instead of ad hoc offsets", () => {
  expect(source("src/app/globals.css")).toContain(".topbar-clearance");

  for (const file of topbarClearanceFiles) {
    expect(source(file), file).toContain("topbar-clearance");
  }

  const forbiddenTopOffsetPatterns = [
    ["src/components/activities/ActivitiesPage.tsx", "pt-28"],
    ["src/components/activities/ActivityDetailPage.tsx", "pt-20"],
    ["src/components/activities/ActivityPieces.tsx", "pt-24"],
    ["src/components/activities/ActivityPieces.tsx", "min-h-[calc(100svh-5rem)]"],
    ["src/components/Hero.tsx", "pt-24"],
    ["src/components/Hero.tsx", "lg:pt-28"],
    ["src/components/leaderboard/LeaderboardUi.tsx", "pt-24"],
    ["src/components/leaderboard/LeaderboardUi.tsx", "md:pt-28"],
    ["src/components/profile/ProfilePageClient.tsx", "pt-28"],
    ["src/components/profile/ProfilePageClient.tsx", "py-28"],
    ["src/components/profile/ProfilePageClient.tsx", "min-h-[calc(100vh-5rem)]"],
    ["src/components/auth/LoginForm.tsx", "py-28"],
    ["src/components/admin/AdminHub.tsx", "pt-20"],
  ] as const;

  for (const [file, pattern] of forbiddenTopOffsetPatterns) {
    expect(source(file), `${file} should not contain ${pattern}`).not.toContain(pattern);
  }
});

test("admin sidebars start at the viewport top and shift the desktop topbar", () => {
  const navbar = source("src/components/NavbarClient.tsx");
  const adminHub = source("src/components/admin/AdminHub.tsx");

  expect(navbar).toContain("const [adminSidebarOpen, setAdminSidebarOpen] = useState(false)");
  expect(navbar).toContain("onOpenChange={setAdminSidebarOpen}");
  expect(navbar).toContain('style={adminSidebarOpen ? { transform: "translateX(300px)", width: "calc(100% - 300px)" } : undefined}');
  expect(navbar).toContain("fixed left-0 top-0 z-[65] h-screen");
  expect(navbar).toContain("fixed left-0 top-0 z-[64] h-screen");
  expect(navbar).toContain("fixed inset-0 z-[90] lg:hidden");
  expect(navbar).toContain("normalizeAdminTab");
  expect(navbar).not.toContain("pathname.startsWith(\"/admin\")");
  expect(navbar).not.toContain("top-20");
  expect(navbar).not.toContain("h-[calc(100vh-5rem)]");

  expect(adminHub).not.toContain("lg:sticky lg:top-0 lg:block lg:h-screen");
  expect(adminHub).not.toContain('id="admin-mobile-drawer"');
  expect(adminHub).not.toContain("lg:top-20");
  expect(adminHub).not.toContain("h-[calc(100vh-5rem)]");
  expect(adminHub).not.toContain("fixed inset-0 top-20");
});
