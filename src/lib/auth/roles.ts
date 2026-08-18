export type AuthRole = "admin" | "user";

export function roleFromClaims(claims: unknown): AuthRole {
  if (!claims || typeof claims !== "object") {
    return "user";
  }

  const appMetadata = (claims as { app_metadata?: unknown }).app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") {
    return "user";
  }

  return (appMetadata as { role?: unknown }).role === "admin" ? "admin" : "user";
}

export function safeInternalRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function loginRedirectPathForRole(role: AuthRole, next?: string | null): string {
  if (role !== "admin") {
    return "/";
  }

  return safeInternalRedirectPath(next, "/admin");
}
