import { NextResponse } from "next/server";
import { toFullActivityPayload } from "@/lib/activities/schema";
import { ActivityRegistrationError, getActivityById, registerAuthenticatedActivity } from "@/lib/activities/server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAuthProfile, type CurrentAuthProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function activityErrorResponse(error: unknown) {
  if (error instanceof ActivityRegistrationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = errorMessage(error, "Activity participant request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

type LinkedAthleteProfile = CurrentAuthProfile & {
  athlete: NonNullable<CurrentAuthProfile["athlete"]>;
};

async function requireLinkedAthlete(): Promise<{ profile: LinkedAthleteProfile } | { response: NextResponse }> {
  const profile = await getCurrentAuthProfile();
  if (!profile) {
    return { response: NextResponse.json({ error: "Login required." }, { status: 401 }) };
  }
  if (!profile.athlete) {
    return { response: NextResponse.json({ error: "Akun belum terhubung ke atlet." }, { status: 403 }) };
  }
  return { profile: { ...profile, athlete: profile.athlete } };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const auth = await requireLinkedAthlete();
    if ("response" in auth) {
      return auth.response;
    }

    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const activity = await registerAuthenticatedActivity(supabase, id, auth.profile.athlete.id, auth.profile.userId);

    return NextResponse.json({ activity: toFullActivityPayload(activity) });
  } catch (error) {
    return activityErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireLinkedAthlete();
    if ("response" in auth) {
      return auth.response;
    }

    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("activity_participants")
      .delete()
      .eq("activity_id", id)
      .eq("athlete_id", auth.profile.athlete.id);

    if (error) {
      throw error;
    }

    const activity = await getActivityById(supabase, id, auth.profile.athlete.id);
    if (!activity) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ activity: toFullActivityPayload(activity) });
  } catch (error) {
    return activityErrorResponse(error);
  }
}
