import { authEmailForUsername, normalizeLoginUsername } from "@/lib/auth/username";

export interface AthleteAuthCreateAttributesInput {
  defaultPassword: string;
  emailDomain: string;
  name: string;
  username: string;
}

export interface AthleteAccountIdentity {
  name: string;
  username: string;
}

export interface AthleteAuthProvisioningOptions {
  defaultPassword: string;
  emailDomain: string;
}

export interface AthleteAuthUpdateAttributesInput {
  emailDomain: string;
  name: string;
  username: string;
}

interface SupabaseAuthAdminLike {
  auth: {
    admin: {
      createUser(attributes: ReturnType<typeof athleteAuthCreateAttributes>): Promise<{
        data?: {
          user?: {
            id?: string;
          } | null;
        } | null;
        error?: {
          message?: string;
        } | null;
      }>;
      deleteUser(id: string): Promise<{ error?: unknown }>;
    };
  };
}

export function athleteDefaultPassword(env: NodeJS.ProcessEnv = process.env): string {
  const password = env.ATHLETE_DEFAULT_PASSWORD?.trim();
  if (!password) {
    throw new Error("ATHLETE_DEFAULT_PASSWORD is not configured.");
  }

  return password;
}

export function athleteAuthCreateAttributes({
  defaultPassword,
  emailDomain,
  name,
  username,
}: AthleteAuthCreateAttributesInput) {
  return {
    app_metadata: { role: "user" },
    email: authEmailForUsername(username, emailDomain),
    email_confirm: true,
    password: defaultPassword,
    user_metadata: {
      display_name: name,
      username,
    },
  };
}

export function normalizeAthleteAccountUsername(value: string): string {
  return normalizeLoginUsername(value);
}

export function athleteAuthUpdateAttributes({
  emailDomain,
  name,
  username,
}: AthleteAuthUpdateAttributesInput) {
  return {
    email: authEmailForUsername(username, emailDomain),
    email_confirm: true,
    user_metadata: {
      display_name: name,
      username,
    },
  };
}

export function athletePasswordResetAttributes(password: string) {
  return { password };
}

export function findDuplicateUsernames(usernames: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  usernames.forEach((username) => {
    if (seen.has(username)) {
      duplicates.add(username);
      return;
    }

    seen.add(username);
  });

  return Array.from(duplicates).sort();
}

export function duplicateUsernameMessage(usernames: string[]): string {
  return `Username sudah digunakan: ${usernames.join(", ")}. Ubah nama atlet atau akun sebelum mencoba lagi.`;
}

export function isDuplicateAuthUserError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const normalized = text.toLowerCase();
  return (
    normalized.includes("duplicate") ||
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  );
}

export async function provisionAthleteUserAccounts(
  supabase: SupabaseAuthAdminLike,
  athletes: AthleteAccountIdentity[],
  options: AthleteAuthProvisioningOptions,
): Promise<Map<string, string>> {
  const created = new Map<string, string>();

  try {
    for (const athlete of athletes) {
      const { data, error } = await supabase.auth.admin.createUser(
        athleteAuthCreateAttributes({
          defaultPassword: options.defaultPassword,
          emailDomain: options.emailDomain,
          name: athlete.name,
          username: athlete.username,
        }),
      );

      if (error) {
        throw new Error(error.message || "Could not create athlete user account.");
      }

      const userId = data?.user?.id;
      if (!userId) {
        throw new Error("Could not create athlete user account.");
      }

      created.set(athlete.username, userId);
    }
  } catch (error) {
    await Promise.all(Array.from(created.values()).map((userId) => supabase.auth.admin.deleteUser(userId).catch(() => null)));
    throw error;
  }

  return created;
}

export async function deleteAthleteUserAccounts(
  supabase: SupabaseAuthAdminLike,
  authUserIds: Iterable<string | null | undefined>,
): Promise<void> {
  await Promise.all(
    Array.from(authUserIds)
      .filter((userId): userId is string => Boolean(userId))
      .map((userId) => supabase.auth.admin.deleteUser(userId).catch(() => null)),
  );
}
