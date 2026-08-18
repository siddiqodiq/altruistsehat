import { Suspense } from "react";
import { LeaderboardPublicPage } from "@/components/leaderboard/LeaderboardPublicPage";
import Navbar from "@/components/Navbar";

export default function LeaderboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <Navbar />
      <Suspense fallback={null}>
        <LeaderboardPublicPage />
      </Suspense>
    </div>
  );
}
