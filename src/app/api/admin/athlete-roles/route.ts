import { NextResponse } from "next/server";
import { z } from "zod";
import { roleChangeAuthorizationFailure } from "@/lib/auth/role-management";
import { roleFromClaims, type AuthRole } from "@/lib/auth/roles";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAuthProfile, requireAdminAuth } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RolePatchSchema = z.object({
  athleteId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

interface AthleteRoleRow {
  id: string;
  name: string;
  username: string | null;
  auth_user_id: string | null;
  profile_photo_url: string | null;
}

interface AuthUserRecord {
  app_metadata?: Record<string, unknown>;
  id: string;
}

function authRole(user: AuthUserRecord | undefined): AuthRole {
  return roleFromClaims({ app_metadata: user?.app_metadata });
}

async function listAuthUsers(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const users: AuthUserRecord[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    const nextUsers = (data?.users ?? []) as AuthUserRecord[];
    users.push(...nextUsers);
    if (nextUsers.length < 1000) {
      break;
    }
    page += 1;
  }

  return users;
}

function roleResponseStatus(error: unknown) {
  const message = errorMessage(error, "Role management request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function GET() {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const supabase = createSupabaseServiceClient();
    const [{ data: athletes, error: athletesError }, users] = await Promise.all([
      supabase
        .from("athletes")
        .select("id,name,username,auth_user_id,profile_photo_url")
        .order("name", { ascending: true }),
      listAuthUsers(supabase),
    ]);

    if (athletesError) {
      throw athletesError;
    }

    const usersById = new Map(users.map((user) => [user.id, user]));
    const adminCount = users.filter((user) => authRole(user) === "admin").length;

    return NextResponse.json({
      adminCount,
      athletes: ((athletes ?? []) as AthleteRoleRow[]).map((athlete) => ({
        authUserId: athlete.auth_user_id ?? undefined,
        id: athlete.id,
        name: athlete.name,
        profilePhotoUrl: athlete.profile_photo_url ?? undefined,
        role: authRole(athlete.auth_user_id ? usersById.get(athlete.auth_user_id) : undefined),
        username: athlete.username ?? undefined,
      })),
    });
  } catch (error) {
    return roleResponseStatus(error);
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const currentProfile = await getCurrentAuthProfile();
    if (!currentProfile) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = RolePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("id,name,username,auth_user_id,profile_photo_url")
      .eq("id", parsed.data.athleteId)
      .single();

    if (athleteError) {
      return NextResponse.json({ error: athleteError.message }, { status: athleteError.code === "PGRST116" ? 404 : 500 });
    }

    const users = await listAuthUsers(supabase);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const targetAuthUserId = (athlete as AthleteRoleRow).auth_user_id;
    const targetUser = targetAuthUserId ? usersById.get(targetAuthUserId) : undefined;
    const targetCurrentRole = authRole(targetUser);
    const adminCount = users.filter((user) => authRole(user) === "admin").length;
    const failure = roleChangeAuthorizationFailure({
      adminCount,
      currentAuthUserId: currentProfile.userId,
      currentRole: currentProfile.role,
      targetAuthUserId,
      targetCurrentRole,
      targetRole: parsed.data.role,
    });

    if (failure) {
      return failure;
    }

    if (!targetAuthUserId || !targetUser) {
      return NextResponse.json({ error: "Akun anggota belum siap dipakai." }, { status: 404 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(targetAuthUserId, {
      app_metadata: {
        ...(targetUser.app_metadata ?? {}),
        role: parsed.data.role,
      },
    });

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      athlete: {
        authUserId: targetAuthUserId,
        id: (athlete as AthleteRoleRow).id,
        name: (athlete as AthleteRoleRow).name,
        profilePhotoUrl: (athlete as AthleteRoleRow).profile_photo_url ?? undefined,
        role: parsed.data.role,
        username: (athlete as AthleteRoleRow).username ?? undefined,
      },
    });
  } catch (error) {
    return roleResponseStatus(error);
  }
}
