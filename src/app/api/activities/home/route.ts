import { NextResponse } from "next/server";
import { toPublicActivityPayload } from "@/lib/activities/schema";
import { listActivities } from "@/lib/activities/server";
import { homeDocumentationCovers, homeSportTypes, homeSportVisuals } from "@/lib/activities/home-activity-content";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activityErrorResponse(error: unknown) {
  const message = errorMessage(error, "Activity home request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function GET() {
  try {
    const activities = await listActivities(createSupabaseServiceClient(), undefined, {
      audience: "authenticated",
    });
    const publicActivities = activities.filter((activity) => activity.visibility === "public");

    return NextResponse.json({
      activities: publicActivities.map(toPublicActivityPayload),
      documentationCovers: homeDocumentationCovers(activities),
      sportVisuals: homeSportVisuals(activities),
      sportTypes: homeSportTypes(activities),
    });
  } catch (error) {
    return activityErrorResponse(error);
  }
}
