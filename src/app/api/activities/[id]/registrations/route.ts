import { NextResponse } from "next/server";
import { ActivityGuestRegistrationPayloadSchema, toFullActivityPayload, toPublicActivityPayload } from "@/lib/activities/schema";
import {
  ActivityRegistrationError,
  registerAuthenticatedActivity,
  registerGuestActivity,
} from "@/lib/activities/server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAuthProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function registrationErrorResponse(error: unknown) {
  if (error instanceof ActivityRegistrationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = errorMessage(error, "Activity registration request failed.");
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const profile = await getCurrentAuthProfile();
    const supabase = createSupabaseServiceClient();

    if (profile) {
      if (!profile.athlete) {
        return NextResponse.json({ error: "Akun belum terhubung ke atlet." }, { status: 403 });
      }

      const activity = await registerAuthenticatedActivity(supabase, id, profile.athlete.id, profile.userId);
      return NextResponse.json({ activity: toFullActivityPayload(activity), registered: true });
    }

    const body = await request.json().catch(() => null);
    const parsed = ActivityGuestRegistrationPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const activity = await registerGuestActivity(supabase, id, parsed.data);
    return NextResponse.json({ activity: toPublicActivityPayload(activity), registered: true }, { status: 201 });
  } catch (error) {
    return registrationErrorResponse(error);
  }
}
