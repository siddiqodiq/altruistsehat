import type { AuthRole } from "./roles";

export interface RoleChangeRequest {
  adminCount: number;
  currentAuthUserId: string;
  currentRole: AuthRole;
  targetAuthUserId: string | null | undefined;
  targetCurrentRole: AuthRole;
  targetRole: AuthRole;
}

export function roleChangeAuthorizationFailure(request: RoleChangeRequest): Response | undefined {
  if (request.currentRole !== "admin") {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!request.targetAuthUserId) {
    return Response.json({ error: "Atlet belum terhubung ke akun Auth." }, { status: 409 });
  }

  if (
    request.currentAuthUserId === request.targetAuthUserId &&
    request.targetCurrentRole === "admin" &&
    request.targetRole === "user"
  ) {
    return Response.json({ error: "Admin tidak bisa menurunkan role akun sendiri." }, { status: 409 });
  }

  if (request.targetCurrentRole === "admin" && request.targetRole === "user" && request.adminCount <= 1) {
    return Response.json({ error: "Minimal harus ada satu admin aktif." }, { status: 409 });
  }

  return undefined;
}
