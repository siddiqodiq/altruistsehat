import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("Navbar is server-wrapped with an auth profile to avoid login flicker", () => {
  const navbar = source("src/components/Navbar.tsx");

  expect(navbar).toContain("getCurrentAuthProfile");
  expect(navbar).toContain("NavbarClient");
  expect(navbar).not.toContain('"use client"');
});

test("Navbar client renders RBAC profile state and does not include Join us", () => {
  const navbarClient = source("src/components/NavbarClient.tsx");

  expect(navbarClient).toContain("profile");
  expect(navbarClient).toContain("profilePhotoUrl");
  expect(navbarClient).toContain("initials");
  expect(navbarClient).toContain("href: \"/event\"");
  expect(navbarClient).toContain("href: \"/kalender\"");
  expect(navbarClient).toContain("/auth/login?next=/event");
  expect(navbarClient).not.toContain("href: \"/kegiatan\"");
  expect(navbarClient).not.toContain("/auth/login?next=/kegiatan");
  expect(navbarClient).toContain("Gabung");
  expect(navbarClient).not.toContain(">Login<");
  expect(navbarClient).not.toContain("Join us");
  expect(navbarClient).not.toContain("Instagram");
  expect(navbarClient).not.toContain("Strava");
});

test("Navbar client switches from transparent top state to floating glass after scroll", () => {
  const navbarClient = source("src/components/NavbarClient.tsx");

  expect(navbarClient).toContain("const [hasScrolled, setHasScrolled] = useState(false)");
  expect(navbarClient).toContain("window.scrollY > 8");
  expect(navbarClient).toContain('window.addEventListener("scroll", handleScroll, { passive: true })');
  expect(navbarClient).toContain('window.removeEventListener("scroll", handleScroll)');
  expect(navbarClient).toContain("hasScrolled ? floatingNavClassName : transparentNavClassName");
  expect(navbarClient).toContain("rounded-[1.6rem]");
  expect(navbarClient).toContain("backdrop-blur-xl");
  expect(navbarClient).not.toContain("fixed z-50 w-full border-b border-secondary-sand/50 bg-primary-beige/90");
});

test("Navbar top state uses normal blending on bright home hero", () => {
  const navbarClient = source("src/components/NavbarClient.tsx");
  const homePage = source("src/app/page.tsx");

  expect(navbarClient).not.toContain("mix-blend-difference");
  expect(navbarClient).toContain('const scrolledNavBlendClassName = "mix-blend-normal"');
  expect(navbarClient).toContain('const inverseTopTextClassName = "text-white transition-opacity hover:opacity-[0.85]"');
  expect(navbarClient).toContain("const topbarInverse = topVariant === \"inverse\" && !hasScrolled");
  expect(navbarClient).toContain("topbarInverse ? inverseTopTextClassName : brandTextThemeClassName");
  expect(navbarClient).toContain("topbarInverse ? inverseTopTextClassName : desktopNavLinkThemeClassName");
  expect(navbarClient).toContain("topbarInverse ? inverseTopTextClassName : mobileMenuButtonThemeClassName");
  expect(homePage).toContain("<Navbar />");
  expect(homePage).not.toContain('topVariant="inverse"');
});

test("activity detail opts into inverse topbar over dark image hero", () => {
  const navbar = source("src/components/Navbar.tsx");
  const navbarClient = source("src/components/NavbarClient.tsx");
  const activityDetailPage = source("src/app/kegiatan/[id]/page.tsx");

  expect(navbar).toContain('topVariant?: "default" | "inverse"');
  expect(navbarClient).toContain('topVariant?: "default" | "inverse"');
  expect(activityDetailPage).toContain('<Navbar topVariant="inverse" />');
});

test("Navbar mobile dropdown stays readable outside the blended topbar layer", () => {
  const navbarClient = source("src/components/NavbarClient.tsx");

  expect(navbarClient).toContain('aria-label={isOpen ? "Tutup menu utama" : "Buka menu utama"}');
  expect(navbarClient).toContain('className="fixed left-0 top-[4.75rem] z-50 w-full md:hidden"');
  expect(navbarClient).toContain("rounded-[1.25rem] border border-secondary-sand/70 bg-white/86");
  expect(navbarClient).toContain("dark:bg-zinc-950/88");
});
