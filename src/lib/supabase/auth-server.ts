import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminAuthorizationFailure } from "@/lib/auth/admin";
import { roleFromClaims, type AuthRole } from "@/lib/auth/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface CurrentAuthProfile {
  userId: string;
  role: AuthRole;
  athlete: {
    id: string;
    name: string;
    profilePhotoUrl?: string;
    username?: string;
  } | null;
}

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return { publishableKey, url };
}

export function isSupabaseAuthConfigError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Supabase auth is not configured");
}

export async function createSupabaseServerAuthClient() {
  const { publishableKey, url } = publicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes them.
        }
      },
    },
  });
}

export async function getCurrentAuthRole(): Promise<AuthRole | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerAuthClient>>;
  try {
    supabase = await createSupabaseServerAuthClient();
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return null;
    }
    throw error;
  }

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return roleFromClaims(data.claims);
}

function isSupabaseServiceConfigError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Supabase is not configured");
}

export async function getCurrentAuthProfile(): Promise<CurrentAuthProfile | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerAuthClient>>;
  try {
    supabase = await createSupabaseServerAuthClient();
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return null;
    }
    throw error;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return null;
  }

  const claimsResult = await supabase.auth.getClaims();
  const role = claimsResult.error || !claimsResult.data?.claims
    ? roleFromClaims({ app_metadata: userData.user.app_metadata })
    : roleFromClaims(claimsResult.data.claims);

  let athlete: CurrentAuthProfile["athlete"] = null;
  try {
    const serviceSupabase = createSupabaseServiceClient();
    const { data, error } = await serviceSupabase
      .from("athletes")
      .select("id,name,username,profile_photo_url")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      athlete = {
        id: data.id,
        name: data.name,
        profilePhotoUrl: data.profile_photo_url ?? undefined,
        username: data.username ?? undefined,
      };
    }
  } catch (error) {
    if (!isSupabaseServiceConfigError(error)) {
      throw error;
    }
  }

  return {
    athlete,
    role,
    userId: userData.user.id,
  };
}

export async function requireAdminAuth(): Promise<Response | undefined> {
  return adminAuthorizationFailure(await getCurrentAuthRole());
}
