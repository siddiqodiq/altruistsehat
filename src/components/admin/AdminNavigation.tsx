"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Trophy, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTab = "leaderboard" | "athletes" | "activities";

export const adminTabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
  { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="size-4" /> },
  { id: "activities", label: "Kegiatan", icon: <CalendarDays className="size-4" /> },
  { id: "athletes", label: "Anggota", icon: <UsersRound className="size-4" /> },
];

export function normalizeAdminTab(value: string | null): AdminTab {
  if (value === "athletes" || value === "roles") {
    return "athletes";
  }
  if (value === "activities") {
    return "activities";
  }

  return "leaderboard";
}

export function adminTabHref(tab: AdminTab): string {
  return `/admin?tab=${tab}`;
}

export function adminTitleForTab(tab: AdminTab): string {
  if (tab === "activities") {
    return "Kegiatan";
  }
  if (tab === "athletes") {
    return "Anggota";
  }

  return "Leaderboard";
}

export function AdminSidebarNav({
  activeTab,
  id = "admin-sidebar-nav",
  onClose,
  onSelect,
}: {
  activeTab?: AdminTab;
  id?: string;
  onClose?: () => void;
  onSelect?: (tab: AdminTab) => void;
}) {
  function itemClassName(tab: AdminTab) {
    return cn(
      "flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-black transition",
      activeTab === tab
        ? "bg-primary-brown text-white shadow-[0_14px_30px_rgb(90,46,23,0.18)]"
        : "text-primary-charcoal/65 hover:bg-secondary-sand/35 hover:text-primary-charcoal dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-gray-100",
    );
  }

  function iconClassName(tab: AdminTab) {
    return cn(
      "grid size-8 shrink-0 place-items-center rounded-lg",
      activeTab === tab ? "bg-white/14" : "bg-secondary-sand/30 dark:bg-zinc-800",
    );
  }

  return (
    <nav aria-label="Admin navigation" className="grid gap-2" id={id}>
      {adminTabs.map((tab) => {
        const content = (
          <>
            <span className={iconClassName(tab.id)}>{tab.icon}</span>
            <span className="min-w-0 truncate">{tab.label}</span>
          </>
        );

        if (onSelect) {
          return (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={itemClassName(tab.id)}
              key={tab.id}
              onClick={() => {
                onSelect(tab.id);
                onClose?.();
              }}
              type="button"
            >
              {content}
            </button>
          );
        }

        return (
          <Link className={itemClassName(tab.id)} href={adminTabHref(tab.id)} key={tab.id} onClick={onClose}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
