import "server-only";

import { requireAdminAuth } from "@/lib/supabase/auth-server";
import { GLOBAL_LEADERBOARD_CLIENT_ID } from "./constants";

export { GLOBAL_LEADERBOARD_CLIENT_ID };

export async function requireLeaderboardAdmin(): Promise<Response | undefined> {
  return requireAdminAuth();
}
