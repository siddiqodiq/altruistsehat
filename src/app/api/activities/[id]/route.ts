import { NextResponse } from "next/server";
import { ActivityPatchSchema, toFullActivityPayload, toPublicActivityPayload } from "@/lib/activities/schema";
import {
  ActivityNotFoundError,
  getActivityById,
  replaceActivityImages,
  replaceActivityParticipants,
  updateActivityRecord,
} from "@/lib/activities/server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAuthProfile, requireAdminAuth } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function activityErrorResponse(error: unknown) {
  if (error instanceof ActivityNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const message = errorMessage(error, "Activity request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const profile = await getCurrentAuthProfile();
    const activity = await getActivityById(createSupabaseServiceClient(), id, profile?.athlete?.id, {
      audience: profile ? "authenticated" : "public",
    });
    if (!activity) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      activity: profile ? toFullActivityPayload(activity) : toPublicActivityPayload(activity),
      authenticated: Boolean(profile),
    });
  } catch (error) {
    return activityErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const profile = await getCurrentAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = ActivityPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    await updateActivityRecord(supabase, id, parsed.data);

    if ("images" in parsed.data && parsed.data.images) {
      await replaceActivityImages(supabase, id, parsed.data.images);
    }
    if ("participantAthleteIds" in parsed.data && parsed.data.participantAthleteIds) {
      await replaceActivityParticipants(supabase, id, parsed.data.participantAthleteIds, profile.userId);
    }

    const updated = await getActivityById(supabase, id, profile.athlete?.id);
    if (!updated) {
      return NextResponse.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ activity: toFullActivityPayload(updated) });
  } catch (error) {
    return activityErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await context.params;
    const { error } = await createSupabaseServiceClient().from("activities").delete().eq("id", id);
    if (error) {
      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return activityErrorResponse(error);
  }
}
