import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  athleteAuthUpdateAttributes,
  athletePasswordResetAttributes,
  duplicateUsernameMessage,
  isDuplicateAuthUserError,
  normalizeAthleteAccountUsername,
} from "@/lib/athletes/accounts";
import { authEmailForUsername, authUsernameEmailDomain } from "@/lib/auth/username";
import { requireAdminAuth } from "@/lib/supabase/auth-server";
import { errorMessage } from "@/lib/supabase/errors";
import {
  athleteSelectColumns,
  createSupabaseServiceClient,
  mapAthleteRow,
  type AthleteRow,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AccountPatchSchema = z.object({
  password: z.string().min(6).optional(),
  username: z.string().optional(),
}).refine((value) => value.username !== undefined || value.password !== undefined, {
  message: "Tidak ada perubahan akun untuk disimpan.",
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface AthleteAccountRow extends AthleteRow {
  auth_user_id: string | null;
  username: string | null;
}

function accountErrorResponse(error: unknown) {
  const message = errorMessage(error, "Account request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

async function loadAthleteAccount(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  id: string,
): Promise<AthleteAccountRow | Response> {
  const { data, error } = await supabase
    .from("athletes")
    .select(athleteSelectColumns())
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: error.code === "PGRST116" ? 404 : 500 });
  }

  const athlete = data as unknown as AthleteAccountRow;
  if (!athlete.auth_user_id) {
    return NextResponse.json({ error: "Akun anggota belum tersedia." }, { status: 409 });
  }

  return athlete;
}

async function usernameIsAvailable(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  athleteId: string,
  username: string,
) {
  const { data, error } = await supabase
    .from("athletes")
    .select("id")
    .eq("username", username)
    .limit(1);

  if (error) {
    throw error;
  }

  return !(data ?? []).some((row) => row.id !== athleteId);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = AccountPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const athlete = await loadAthleteAccount(supabase, id);
    if (athlete instanceof Response) {
      return athlete;
    }

    const authUserId = athlete.auth_user_id;
    if (!authUserId) {
      return NextResponse.json({ error: "Akun anggota belum tersedia." }, { status: 409 });
    }
    const emailDomain = authUsernameEmailDomain();
    const nextUsername = parsed.data.username === undefined
      ? undefined
      : normalizeAthleteAccountUsername(parsed.data.username);

    if (nextUsername !== undefined) {
      if (!nextUsername) {
        return NextResponse.json({ error: "Username tidak boleh kosong." }, { status: 400 });
      }

      if (!(await usernameIsAvailable(supabase, id, nextUsername))) {
        return NextResponse.json({ error: duplicateUsernameMessage([nextUsername]) }, { status: 409 });
      }

      if (nextUsername !== athlete.username) {
        try {
          const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
            authUserId,
            athleteAuthUpdateAttributes({
              emailDomain,
              name: athlete.name,
              username: nextUsername,
            }),
          );

          if (authUpdateError) {
            throw authUpdateError;
          }
        } catch (error) {
          if (isDuplicateAuthUserError(error)) {
            return NextResponse.json({ error: duplicateUsernameMessage([nextUsername]) }, { status: 409 });
          }

          throw error;
        }

        const { error: athleteUpdateError } = await supabase
          .from("athletes")
          .update({ username: nextUsername })
          .eq("id", id);

        if (athleteUpdateError) {
          await supabase.auth.admin.updateUserById(authUserId, {
            email: athlete.username ? authEmailForUsername(athlete.username, emailDomain) : undefined,
            user_metadata: {
              display_name: athlete.name,
              username: athlete.username,
            },
          }).catch(() => null);

          if (athleteUpdateError.code === "23505") {
            return NextResponse.json({ error: duplicateUsernameMessage([nextUsername]) }, { status: 409 });
          }

          throw athleteUpdateError;
        }
      }
    }

    if (parsed.data.password !== undefined) {
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        authUserId,
        athletePasswordResetAttributes(parsed.data.password),
      );

      if (passwordError) {
        throw passwordError;
      }
    }

    const { data: updatedAthlete, error: updatedError } = await supabase
      .from("athletes")
      .select(athleteSelectColumns())
      .eq("id", id)
      .single();

    if (updatedError) {
      throw updatedError;
    }

    return NextResponse.json({ athlete: mapAthleteRow(updatedAthlete as unknown as AthleteRow) });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
