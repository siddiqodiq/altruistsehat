import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  athletePhotoFilename,
  athletePhotoUrlForKind,
  type AthletePhotoSource,
} from "@/lib/athletes/photo-download";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PhotoKindSchema = z.enum(["profile", "podium"]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const kind = PhotoKindSchema.safeParse(request.nextUrl.searchParams.get("kind"));
    if (!kind.success) {
      return jsonError("Invalid photo kind.", 400);
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("athletes")
      .select("name,profile_photo_url,podium_photo_url")
      .eq("id", id)
      .single();

    if (error) {
      return jsonError(error.message, error.code === "PGRST116" ? 404 : 500);
    }

    const athlete = data as AthletePhotoSource;
    const photoUrl = athletePhotoUrlForKind(athlete, kind.data);
    if (!photoUrl) {
      return jsonError("Athlete photo is not available.", 404);
    }

    const photoResponse = await fetch(photoUrl, { cache: "no-store" });
    if (!photoResponse.ok) {
      return jsonError("Could not download athlete photo.", 502);
    }

    const contentType = photoResponse.headers.get("content-type") ?? "image/jpeg";
    const filename = athletePhotoFilename(athlete.name, kind.data, contentType, photoUrl);
    const body = await photoResponse.arrayBuffer();

    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    const message = errorMessage(error, "Athlete photo download failed.");
    return jsonError(message, message.includes("Supabase is not configured") ? 503 : 500);
  }
}
