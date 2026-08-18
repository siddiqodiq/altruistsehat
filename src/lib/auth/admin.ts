import type { AuthRole } from "@/lib/auth/roles";

export type { AuthRole };

export function adminAuthorizationFailure(role: AuthRole | null): Response | undefined {
  if (!role) {
    return Response.json({ success: false, error: "Login required.", message: "Login required." }, { status: 401 });
  }

  if (role !== "admin") {
    return Response.json({ success: false, error: "Admin access required.", message: "Admin access required." }, { status: 403 });
  }

  return undefined;
}
