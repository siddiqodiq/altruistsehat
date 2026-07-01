"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, Trophy } from "lucide-react";
import Navbar from "@/components/Navbar";
import { AthleteDatabaseApp } from "@/components/athletes/AthleteDatabaseApp";
import { LeaderboardAdminManager } from "@/components/leaderboard/LeaderboardAdminManager";
import { UNSAVED_ADMIN_CHANGES_STORAGE_KEY } from "@/lib/leaderboard/admin-management";
import { cn } from "@/lib/utils";

type AdminTab = "leaderboard" | "athletes";

const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
  { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="size-4" /> },
  { id: "athletes", label: "Athlete Database", icon: <Database className="size-4" /> },
];

function normalizeTab(value: string | null): AdminTab {
  return value === "athletes" ? "athletes" : "leaderboard";
}

export function AdminHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));
  const title = useMemo(
    () => (activeTab === "athletes" ? "Athlete Database" : "Leaderboard Admin"),
    [activeTab],
  );

  function setActiveTab(tab: AdminTab) {
    const hasUnsavedLeaderboardChanges = window.localStorage.getItem(UNSAVED_ADMIN_CHANGES_STORAGE_KEY) === "true";
    if (activeTab === "leaderboard" && tab !== activeTab && hasUnsavedLeaderboardChanges) {
      const confirmed = window.confirm("Anda memiliki perubahan yang belum disimpan.");
      if (!confirmed) {
        return;
      }
    }

    router.replace(`/admin?tab=${tab}`);
  }

  return (
    <main className="min-h-screen bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <Navbar />
      {activeTab === "leaderboard" ? (
        <>
          <div className="fixed left-4 right-4 top-20 z-50 flex justify-center rounded-full border border-secondary-sand/70 bg-white/88 p-1 shadow-[0_16px_42px_rgb(90,46,23,0.12)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/88 md:left-auto md:top-24">
            {tabs.map((tab) => (
              <button
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition",
                  activeTab === tab.id
                    ? "bg-primary-brown text-white"
                    : "text-primary-charcoal/65 hover:bg-secondary-sand/35 dark:text-gray-300 dark:hover:bg-zinc-800",
                )}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <LeaderboardAdminManager />
        </>
      ) : (
        <section className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary-brown dark:text-secondary-sand">
                Admin Area
              </p>
              <h1 className="font-poppins text-4xl font-bold tracking-normal text-primary-charcoal dark:text-gray-100 md:text-5xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-primary-charcoal/65 dark:text-gray-400">
                Kelola data leaderboard, histori mingguan, dan database atlet dari satu tempat.
              </p>
            </div>
            <div className="flex rounded-full border border-secondary-sand/70 bg-white/75 p-1 dark:border-zinc-800 dark:bg-zinc-900">
                {tabs.map((tab) => (
                  <button
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition",
                      activeTab === tab.id
                        ? "bg-primary-brown text-white"
                        : "text-primary-charcoal/65 hover:bg-secondary-sand/35 dark:text-gray-300 dark:hover:bg-zinc-800",
                    )}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          <AthleteDatabaseApp embedded />
        </section>
      )}
    </main>
  );
}
