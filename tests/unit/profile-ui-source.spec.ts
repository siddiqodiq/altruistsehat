import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("navbar profile pill shows name before avatar and exposes hover profile menu", () => {
  const navbar = source("src/components/NavbarClient.tsx");

  expect(navbar).toContain("href=\"/profil\"");
  expect(navbar).toContain("Profil");
  expect(navbar).toContain("Logout");
  expect(navbar).toContain("onMouseEnter");
  expect(navbar).toContain("onFocus");
  expect(navbar).toContain("onBlur");
  expect(navbar).toContain("event.key === \"Escape\"");
  expect(navbar).toContain("triggerRef.current?.focus()");

  const nameIndex = navbar.indexOf("data-profile-name");
  const avatarIndex = navbar.indexOf("data-profile-avatar");
  expect(nameIndex).toBeGreaterThan(-1);
  expect(avatarIndex).toBeGreaterThan(-1);
  expect(nameIndex).toBeLessThan(avatarIndex);
});

test("navbar desktop profile menu stays flush with the profile pill hover area", () => {
  const navbar = source("src/components/NavbarClient.tsx");

  expect(navbar).toContain("top-full");
  expect(navbar).toContain("min-w-full");
  expect(navbar).not.toContain("top-[calc(100%+");
});

test("global admin sidebar is admin-only and remains available on admin pages", () => {
  const navbar = source("src/components/NavbarClient.tsx");

  expect(navbar).toContain("GlobalAdminSidebar");
  expect(navbar).toContain("profile.role !== \"admin\"");
  expect(navbar).toContain("pathname === \"/admin\"");
  expect(navbar).toContain("normalizeAdminTab");
  expect(navbar).not.toContain("pathname.startsWith(\"/admin\")");
  expect(navbar).toContain("admin-hover-sidebar");
  expect(navbar).toContain("admin-mobile-sidebar-trigger");
  expect(navbar).toContain("mobileCloseRef.current?.focus()");
  expect(navbar).toContain("window.addEventListener(\"keydown\", handleEscape)");
});

test("profile page includes athlete info, sports, mileage, photo editing, and password form", () => {
  const page = source("src/app/profil/page.tsx");
  const client = source("src/components/profile/ProfilePageClient.tsx");

  expect(page).toContain("getCurrentAuthProfile");
  expect(page).toContain("redirect(`/auth/login?next=");
  expect(client).toContain("mileageBySport");
  expect(client).toContain("Olahraga yang Diikuti");
  expect(client).toContain("Edit Profil");
  expect(client).toContain("Ganti Password");
  expect(client).toContain("sportPodiumPhotoUrls");
});
