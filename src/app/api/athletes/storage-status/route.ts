import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ATHLETE_STORAGE_BUCKETS, ensureAthleteStorageBuckets } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const validation = await ensureAthleteStorageBuckets(supabase);

    return NextResponse.json({
      ok: validation.missing.length === 0,
      required: ATHLETE_STORAGE_BUCKETS.map((bucket) => ({
        id: bucket.id,
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes,
      })),
      ...validation,
    });
  } catch (error) {
    const message = errorMessage(error, "Could not validate athlete storage buckets.");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        required: ATHLETE_STORAGE_BUCKETS.map((bucket) => bucket.id),
      },
      { status: message.includes("Supabase is not configured") ? 503 : 500 },
    );
  }
}
