import { Suspense } from "react";
import { LeaderboardPublicPage } from "@/components/leaderboard/LeaderboardPublicPage";

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardPublicPage />
    </Suspense>
  );
}
