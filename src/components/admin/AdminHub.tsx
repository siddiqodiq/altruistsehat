"use client";

import { useSearchParams } from "next/navigation";
import {
  normalizeAdminTab,
} from "@/components/admin/AdminNavigation";
import { ActivityAdminPanel } from "@/components/admin/ActivityAdminPanel";
import { AthleteDatabaseApp } from "@/components/athletes/AthleteDatabaseApp";
import { LeaderboardAdminManager } from "@/components/leaderboard/LeaderboardAdminManager";

export function AdminHub() {
  const searchParams = useSearchParams();
  const activeTab = normalizeAdminTab(searchParams.get("tab"));

  const content = (
    <>
      {activeTab === "leaderboard" ? <LeaderboardAdminManager /> : null}
      {activeTab === "athletes" ? (
        <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-20">
          <AthleteDatabaseApp embedded />
        </section>
      ) : null}
      {activeTab === "activities" ? (
        <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-20">
          <ActivityAdminPanel />
        </section>
      ) : null}
    </>
  );

  return (
    <main className="topbar-clearance min-h-screen bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100" id="main-content">
      <div className="min-w-0">
        {content}
      </div>
    </main>
  );
}
