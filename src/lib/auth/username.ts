import { normalizeAthleteName } from "@/lib/athletes/normalize";

const DEFAULT_AUTH_USERNAME_EMAIL_DOMAIN = "users.altruistsehat.local";

export function deriveUsernameFromAthleteName(name: string): string {
  return normalizeAthleteName(name).split(" ").filter(Boolean).slice(0, 2).join(".");
}

export function normalizeLoginUsername(value: string): string {
  return normalizeAthleteName(value).replace(/\s+/g, ".");
}

export function authUsernameEmailDomain(env: NodeJS.ProcessEnv = process.env): string {
  return env.AUTH_USERNAME_EMAIL_DOMAIN?.trim() || DEFAULT_AUTH_USERNAME_EMAIL_DOMAIN;
}

export function authEmailForUsername(username: string, domain = authUsernameEmailDomain()): string {
  return `${normalizeLoginUsername(username)}@${domain}`;
}

export function loginCredentialsFromFormData(formData: FormData, domain = authUsernameEmailDomain()) {
  const username = normalizeLoginUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  return {
    email: authEmailForUsername(username, domain),
    password,
    username,
  };
}
