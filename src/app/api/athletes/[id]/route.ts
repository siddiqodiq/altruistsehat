import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import { PodiumPhotoAdjustmentsSchema } from "@/lib/athletes/photo-adjustments-schema";
import { normalizeSportPodiumPhotoUrls } from "@/lib/athletes/sport-podium-photos";
import { SportPodiumPhotoUrlsSchema } from "@/lib/athletes/sport-podium-photos-schema";
import { errorMessage } from "@/lib/supabase/errors";
import {
  ATHLETE_PODIUM_ADJUSTMENTS_MIGRATION_MESSAGE,
  ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE,
  athleteSelectColumns,
  createSupabaseServiceClient,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  mapAthleteRow,
  withoutAthletePodiumPhotoAdjustments,
  withoutAthleteSportPodiumPhotoUrls,
  type AthleteRow,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OptionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().url().optional(),
);

const AthletePatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  profilePhotoUrl: OptionalUrlSchema,
  podiumPhotoUrl: OptionalUrlSchema,
  sportPodiumPhotoUrls: SportPodiumPhotoUrlsSchema.optional(),
  podiumPhotoAdjustments: PodiumPhotoAdjustmentsSchema.optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

function errorResponse(error: unknown, fallback = "Athlete database request failed.") {
  const message = errorMessage(error, fallback);
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = AthletePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    const sportPodiumPhotoUrls = normalizeSportPodiumPhotoUrls(parsed.data.sportPodiumPhotoUrls);
    const hasSportPodiumPhotoUrls = Object.keys(sportPodiumPhotoUrls).length > 0;
    if (parsed.data.name !== undefined) {
      patch.name = parsed.data.name;
      patch.normalized_name = normalizeAthleteName(parsed.data.name);
    }
    if ("profilePhotoUrl" in parsed.data) {
      patch.profile_photo_url = parsed.data.profilePhotoUrl ?? null;
    }
    if ("podiumPhotoUrl" in parsed.data) {
      patch.podium_photo_url = parsed.data.podiumPhotoUrl ?? null;
    }
    if ("sportPodiumPhotoUrls" in parsed.data) {
      patch.sport_podium_photo_urls = sportPodiumPhotoUrls;
    }
    if ("podiumPhotoAdjustments" in parsed.data) {
      patch.podium_photo_adjustments = parsed.data.podiumPhotoAdjustments ?? {};
    }

    const supabase = createSupabaseServiceClient();
    let { data, error } = await supabase
      .from("athletes")
      .update(patch)
      .eq("id", id)
      .select(athleteSelectColumns())
      .single();
    if (error && isMissingAthletePodiumPhotoAdjustmentsColumn(error)) {
      const fallbackPatch = withoutAthletePodiumPhotoAdjustments(patch);
      if (!Object.keys(fallbackPatch).length) {
        return NextResponse.json({ error: ATHLETE_PODIUM_ADJUSTMENTS_MIGRATION_MESSAGE }, { status: 409 });
      }

      ({ data, error } = await supabase
        .from("athletes")
        .update(fallbackPatch)
        .eq("id", id)
        .select(athleteSelectColumns({ includePodiumPhotoAdjustments: false }))
        .single());
    }
    if (error && isMissingAthleteSportPodiumPhotoUrlsColumn(error)) {
      if (hasSportPodiumPhotoUrls) {
        return NextResponse.json({ error: ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE }, { status: 409 });
      }

      const fallbackPatch = withoutAthleteSportPodiumPhotoUrls(patch);
      if (!Object.keys(fallbackPatch).length) {
        return NextResponse.json({ error: ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE }, { status: 409 });
      }

      ({ data, error } = await supabase
        .from("athletes")
        .update(fallbackPatch)
        .eq("id", id)
        .select(athleteSelectColumns({ includeSportPodiumPhotoUrls: false }))
        .single());
    }

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ athlete: mapAthleteRow(data as unknown as AthleteRow) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("athletes").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
