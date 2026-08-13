"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, LogOut, Menu, Moon, User, UserPlus, Sun, X } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import logoImg from "../assets/LOGO.webp";
import logoPutih from "../assets/logoputih.webp";
import { AdminSidebarNav, normalizeAdminTab, type AdminTab } from "@/components/admin/AdminNavigation";
import { useTheme } from "@/components/ThemeContext";
import type { AuthRole } from "@/lib/auth/roles";
import { UNSAVED_ADMIN_CHANGES_STORAGE_KEY } from "@/lib/leaderboard/admin-management";

export interface NavbarProfile {
  athleteId?: string;
  name: string;
  profilePhotoUrl?: string;
  role: AuthRole;
  username?: string;
}

interface NavbarClientProps {
  logoutAction: () => Promise<void>;
  profile: NavbarProfile | null;
  topVariant?: "default" | "inverse";
}

const navLinks = [
  { name: "Beranda", href: "/" },
  { name: "Event", href: "/event" },
  { name: "Kalender", href: "/kalender" },
  { name: "Leaderboard", href: "/leaderboard" },
];

const navbarGutterClassName = "w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12";

const transparentNavClassName = "rounded-none border-transparent bg-transparent shadow-none backdrop-blur-0";

const floatingNavClassName =
  "rounded-[1.6rem] border-secondary-sand/70 bg-white/76 shadow-[0_18px_54px_rgb(90,46,23,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/76 dark:shadow-[0_18px_54px_rgb(0,0,0,0.32)]";

const scrolledNavBlendClassName = "mix-blend-normal";
const inverseTopTextClassName = "text-white transition-opacity hover:opacity-[0.85]";
const brandTextThemeClassName = "text-primary-charcoal transition-colors dark:text-gray-100";
const desktopNavLinkThemeClassName =
  "text-primary-charcoal transition-colors hover:text-primary-brown dark:text-gray-300 dark:hover:text-secondary-sand";
const mobileMenuButtonThemeClassName =
  "text-primary-charcoal transition-colors hover:text-primary-brown dark:text-gray-300 dark:hover:text-secondary-sand";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AS";
}

function ThemeToggle({
  theme,
  toggleTheme,
}: {
  theme: string;
  toggleTheme: () => void;
}) {
  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-8 w-[60px] items-center rounded-full bg-[#f4f6f9] p-1 shadow-inner transition-colors duration-300 dark:bg-[#0f111a]"
      aria-label="Toggle Dark Mode"
      type="button"
    >
      <div
        className={`absolute h-6 w-6 rounded-full transition-all duration-300 ease-in-out ${
          theme === "dark" ? "translate-x-[28px] bg-[#2d324f]" : "translate-x-0 bg-[#e2e8f0]"
        }`}
      />
      <div className="pointer-events-none relative z-10 flex w-full justify-between px-[3px]">
        <Sun className={`h-[18px] w-[18px] transition-colors duration-300 ${theme === "dark" ? "text-slate-500" : "text-slate-800"}`} />
        <Moon className={`h-[18px] w-[18px] transition-colors duration-300 ${theme === "dark" ? "text-white" : "text-slate-400"}`} />
      </div>
    </button>
  );
}

function LoginLink({ mobile = false, onClick }: { mobile?: boolean; onClick?: () => void }) {
  return (
    <Link
      href="/auth/login?next=/event"
      onClick={onClick}
      className={
        mobile
          ? "flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-primary-charcoal hover:bg-secondary-sand/30 hover:text-primary-brown dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-secondary-sand"
          : "inline-flex h-10 items-center gap-2 rounded-full bg-primary-brown px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-brown/90 dark:bg-secondary-sand dark:text-primary-charcoal dark:hover:bg-secondary-sand/90"
      }
    >
      <UserPlus className="size-4" />
      Gabung
    </Link>
  );
}

function ProfilePill({
  mobile = false,
  logoutAction,
  onNavigate,
  profile,
}: {
  mobile?: boolean;
  logoutAction: () => Promise<void>;
  onNavigate?: () => void;
  profile: NavbarProfile;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const avatar = (
    <span
      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-green/15 text-xs font-black text-primary-green"
    >
      {profile.profilePhotoUrl ? (
        <img alt={`${profile.name} profile`} className="h-full w-full object-cover" src={profile.profilePhotoUrl} />
      ) : (
        initials(profile.name)
      )}
    </span>
  );

  if (mobile) {
    return (
      <div className="grid gap-2 rounded-xl border border-secondary-sand/70 bg-white/75 p-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Link className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-2" href="/profil" onClick={onNavigate}>
          <span className="min-w-0 truncate text-sm font-bold" data-profile-name>
            {profile.name}
          </span>
          <span data-profile-avatar>{avatar}</span>
        </Link>
        <form action={logoutAction}>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-black text-primary-charcoal/70 transition hover:bg-secondary-sand/35 hover:text-primary-brown dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-secondary-sand"
            type="submit"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setMenuOpen(false);
        }
      }}
      onFocus={() => setMenuOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setMenuOpen(false);
          triggerRef.current?.focus();
        }
      }}
      onMouseEnter={() => setMenuOpen(true)}
      onMouseLeave={() => setMenuOpen(false)}
    >
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="inline-flex h-11 items-center gap-3 rounded-full border border-primary-brown/20 bg-white/70 pl-4 pr-1.5 text-sm font-bold text-primary-charcoal shadow-sm transition-colors hover:border-primary-brown/35 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-gray-100"
        ref={triggerRef}
        type="button"
      >
        <span className="max-w-[170px] truncate" data-profile-name>
          {profile.name}
        </span>
        <span data-profile-avatar>{avatar}</span>
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-full z-[80] w-48 min-w-full overflow-hidden rounded-xl border border-secondary-sand/70 bg-white py-2 shadow-[0_18px_44px_rgb(31,31,31,0.14)] dark:border-zinc-800 dark:bg-zinc-950"
          role="menu"
        >
          <Link
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-black text-primary-charcoal transition hover:bg-secondary-sand/25 hover:text-primary-brown dark:text-gray-200 dark:hover:bg-zinc-900 dark:hover:text-secondary-sand"
            href="/profil"
            onClick={onNavigate}
            role="menuitem"
          >
            <User className="size-4" />
            Profil
          </Link>
          <form action={logoutAction}>
            <button
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-black text-primary-charcoal/70 transition hover:bg-secondary-sand/25 hover:text-primary-brown dark:text-gray-300 dark:hover:bg-zinc-900 dark:hover:text-secondary-sand"
              role="menuitem"
              type="submit"
            >
              <LogOut className="size-4" />
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function GlobalAdminSidebar({
  onOpenChange,
  profile,
}: {
  onOpenChange: (open: boolean) => void;
  profile: NavbarProfile | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab | undefined>(undefined);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const isAdminPath = pathname === "/admin";
  const desktopSidebarAvailable = Boolean(profile?.role === "admin");

  useEffect(() => {
    function refreshActiveAdminTab() {
      setActiveAdminTab(isAdminPath ? normalizeAdminTab(new URLSearchParams(window.location.search).get("tab")) : undefined);
    }

    refreshActiveAdminTab();
    window.addEventListener("popstate", refreshActiveAdminTab);
    return () => window.removeEventListener("popstate", refreshActiveAdminTab);
  }, [isAdminPath]);

  useEffect(() => {
    if (mobileOpen) {
      mobileCloseRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  useEffect(() => {
    onOpenChange(desktopSidebarAvailable && open);
    return () => onOpenChange(false);
  }, [desktopSidebarAvailable, onOpenChange, open]);

  if (!profile || profile.role !== "admin") {
    return null;
  }

  function handleAdminTabSelect(tab: AdminTab) {
    if (
      activeAdminTab === "leaderboard" &&
      tab !== activeAdminTab &&
      window.localStorage.getItem(UNSAVED_ADMIN_CHANGES_STORAGE_KEY) === "true" &&
      !window.confirm("Anda memiliki perubahan yang belum disimpan.")
    ) {
      return;
    }

    router.replace(`/admin?tab=${tab}`);
    setActiveAdminTab(tab);
  }

  return (
    <>
      <div
        className="hidden lg:block"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          aria-label="Buka sidebar admin"
          className="fixed left-0 top-0 z-[65] h-screen w-4 cursor-pointer bg-transparent focus:outline-none focus:ring-2 focus:ring-primary-brown/30"
          onFocus={() => setOpen(true)}
          type="button"
        />
        <aside
          className={`fixed left-0 top-0 z-[64] h-screen w-[300px] border-r border-secondary-sand/70 bg-white/96 p-4 pt-6 shadow-[18px_0_54px_rgb(31,31,31,0.16)] backdrop-blur transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950/96 ${
            open ? "translate-x-0" : "-translate-x-[286px]"
          }`}
          id="admin-hover-sidebar"
        >
          <AdminSidebarNav activeTab={activeAdminTab} onSelect={handleAdminTabSelect} />
        </aside>
      </div>

      <button
        aria-label="Buka menu admin"
        className="admin-mobile-sidebar-trigger fixed bottom-5 left-5 z-[75] grid size-12 place-items-center rounded-full border border-secondary-sand bg-white text-primary-brown shadow-[0_12px_30px_rgb(31,31,31,0.16)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-secondary-sand lg:hidden"
        onClick={() => setMobileOpen(true)}
        type="button"
      >
        <LayoutDashboard className="size-5" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button
            aria-label="Tutup menu admin"
            className="absolute inset-0 bg-primary-charcoal/42 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-[min(320px,calc(100vw-32px))] border-r border-secondary-sand bg-white p-4 shadow-[18px_0_54px_rgb(31,31,31,0.18)] dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex justify-end">
              <button
                aria-label="Tutup menu admin"
                className="grid size-10 place-items-center rounded-full border border-secondary-sand text-primary-charcoal/70 hover:bg-secondary-sand/25 dark:border-zinc-700 dark:text-gray-200"
                onClick={() => setMobileOpen(false)}
                ref={mobileCloseRef}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <AdminSidebarNav activeTab={activeAdminTab} id="admin-mobile-sidebar-nav" onClose={() => setMobileOpen(false)} onSelect={handleAdminTabSelect} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function NavbarClient({ logoutAction, profile, topVariant = "default" }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const topbarInverse = topVariant === "inverse" && !hasScrolled;
  const currentLogo = topbarInverse || theme === "dark" ? logoPutih : logoImg;
  const navSurfaceClassName = hasScrolled ? floatingNavClassName : transparentNavClassName;
  const navBlendClassName = scrolledNavBlendClassName;
  const brandTextClassName = topbarInverse ? inverseTopTextClassName : brandTextThemeClassName;
  const desktopNavLinkClassName = topbarInverse ? inverseTopTextClassName : desktopNavLinkThemeClassName;
  const mobileMenuButtonClassName = topbarInverse ? inverseTopTextClassName : mobileMenuButtonThemeClassName;

  useEffect(() => {
    function handleScroll() {
      setHasScrolled(window.scrollY > 8);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <GlobalAdminSidebar onOpenChange={setAdminSidebarOpen} profile={profile} />
      <nav
        aria-label="Navigasi utama"
        className={`fixed left-0 top-0 z-50 w-full py-3 transition-all duration-300 ${navBlendClassName}`}
        style={adminSidebarOpen ? { transform: "translateX(300px)", width: "calc(100% - 300px)" } : undefined}
      >
        <div className={navbarGutterClassName}>
          <div className={`border transition-all duration-300 ease-out ${navSurfaceClassName}`}>
            <div className="flex h-14 items-center justify-between px-3 sm:px-4 lg:px-6">
              <Link className="flex min-w-0 items-center gap-2" href="/">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                  <Image src={currentLogo} alt="Altruist Sehat" fill className="object-contain" />
                </div>
                <span className={`truncate font-poppins text-xl font-semibold ${brandTextClassName}`}>
                  Altruist Sehat
                </span>
              </Link>

              <div className="hidden items-center space-x-8 md:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`font-medium ${desktopNavLinkClassName}`}
                  >
                    {link.name}
                  </Link>
                ))}
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                {profile ? <ProfilePill logoutAction={logoutAction} profile={profile} /> : <LoginLink />}
              </div>

              <div className="flex items-center gap-4 md:hidden">
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  aria-label={isOpen ? "Tutup menu utama" : "Buka menu utama"}
                  className={`focus:outline-none ${mobileMenuButtonClassName}`}
                  type="button"
                >
                  {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed left-0 top-[4.75rem] z-50 w-full md:hidden"
          style={adminSidebarOpen ? { transform: "translateX(300px)", width: "calc(100% - 300px)" } : undefined}
        >
          <div className={navbarGutterClassName}>
            <div className="rounded-[1.25rem] border border-secondary-sand/70 bg-white/86 p-2 shadow-[0_18px_44px_rgb(90,46,23,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/88">
              <div className="space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="block rounded-md px-3 py-2 text-base font-medium text-primary-charcoal hover:bg-secondary-sand/30 hover:text-primary-brown dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-secondary-sand"
                  >
                    {link.name}
                  </Link>
                ))}
                {profile ? (
                  <ProfilePill logoutAction={logoutAction} mobile onNavigate={() => setIsOpen(false)} profile={profile} />
                ) : (
                  <LoginLink mobile onClick={() => setIsOpen(false)} />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </>
  );
}
