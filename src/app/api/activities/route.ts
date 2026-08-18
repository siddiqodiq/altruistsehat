import { NextResponse } from "next/server";
import { ActivityPayloadSchema, toFullActivityPayload, toPublicActivityPayload } from "@/lib/activities/schema";
import {
  getActivityById,
  insertActivityRecord,
  listActivities,
  replaceActivityImages,
  replaceActivityParticipants,
} from "@/lib/activities/server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAuthProfile, requireAdminAuth } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activityErrorResponse(error: unknown) {
  const message = errorMessage(error, "Activity request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function GET() {
  try {
    const profile = await getCurrentAuthProfile();
    const supabase = createSupabaseServiceClient();
    const activities = await listActivities(supabase, profile?.athlete?.id, {
      audience: profile ? "authenticated" : "public",
    });

    return NextResponse.json({
      activities: activities.map((activity) => (profile ? toFullActivityPayload(activity) : toPublicActivityPayload(activity))),
      authenticated: Boolean(profile),
    });
  } catch (error) {
    return activityErrorResponse(error);
  }
}

export async function POST(request: Request) {
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
    const parsed = ActivityPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const activity = await insertActivityRecord(supabase, parsed.data, profile.userId);
    await replaceActivityImages(supabase, activity.id, parsed.data.images);
    await replaceActivityParticipants(supabase, activity.id, parsed.data.participantAthleteIds, profile.userId);

    const created = await getActivityById(supabase, activity.id, profile.athlete?.id);
    return NextResponse.json({ activity: created ? toFullActivityPayload(created) : null }, { status: 201 });
  } catch (error) {
    return activityErrorResponse(error);
  }
}
