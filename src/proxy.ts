import type { NextRequest } from "next/server";
import { updateSupabaseAuthSession } from "@/lib/supabase/auth-proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseAuthSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
