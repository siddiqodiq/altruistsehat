import { NextResponse } from "next/server";
import { ActivityParticipantsReplaceSchema, toFullActivityPayload } from "@/lib/activities/schema";
import { getActivityById, replaceActivityParticipants } from "@/lib/activities/server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAuthProfile, requireAdminAuth } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function activityErrorResponse(error: unknown) {
  const message = errorMessage(error, "Activity participant request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const profile = await getCurrentAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = ActivityParticipantsReplaceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    await replaceActivityParticipants(supabase, id, parsed.data.athleteIds, profile.userId);
    const activity = await getActivityById(supabase, id, profile.athlete?.id);
    if (!activity) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ activity: toFullActivityPayload(activity) });
  } catch (error) {
    return activityErrorResponse(error);
  }
}
