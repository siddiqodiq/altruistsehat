import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import { PodiumPhotoAdjustmentsSchema } from "@/lib/athletes/photo-adjustments-schema";
import { normalizeSportPodiumPhotoUrls } from "@/lib/athletes/sport-podium-photos";
import { SportPodiumPhotoUrlsSchema } from "@/lib/athletes/sport-podium-photos-schema";
import { errorMessage } from "@/lib/supabase/errors";
import {
  ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE,
  athleteSelectColumns,
  createSupabaseServiceClient,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  mapAthleteRow,
  type AthleteRow,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OptionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().url().optional(),
);

const AthletePayloadSchema = z.object({
  name: z.string().trim().min(1),
  profilePhotoUrl: OptionalUrlSchema,
  podiumPhotoUrl: OptionalUrlSchema,
  sportPodiumPhotoUrls: SportPodiumPhotoUrlsSchema.optional(),
  podiumPhotoAdjustments: PodiumPhotoAdjustmentsSchema.optional(),
});

function errorResponse(error: unknown, fallback = "Athlete database request failed.") {
  const message = errorMessage(error, fallback);
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

function athleteListQuery(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  normalizedSearch: string,
  options: { includePodiumPhotoAdjustments: boolean; includeSportPodiumPhotoUrls: boolean },
) {
  let query = supabase
    .from("athletes")
    .select(athleteSelectColumns(options))
    .order("name", { ascending: true })
    .limit(200);

  if (normalizedSearch) {
    query = query.ilike("normalized_name", `%${normalizedSearch}%`);
  }

  return query;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("q") ?? "";
    const normalizedSearch = normalizeAthleteName(search);
    const supabase = createSupabaseServiceClient();
    const options = { includePodiumPhotoAdjustments: true, includeSportPodiumPhotoUrls: true };
    let { data, error } = await athleteListQuery(supabase, normalizedSearch, options);
    if (error && isMissingAthletePodiumPhotoAdjustmentsColumn(error)) {
      options.includePodiumPhotoAdjustments = false;
      ({ data, error } = await athleteListQuery(supabase, normalizedSearch, options));
    }
    if (error && isMissingAthleteSportPodiumPhotoUrlsColumn(error)) {
      options.includeSportPodiumPhotoUrls = false;
      ({ data, error } = await athleteListQuery(supabase, normalizedSearch, options));
    }

    if (error) {
      throw error;
    }

    return NextResponse.json({ athletes: ((data ?? []) as unknown as AthleteRow[]).map(mapAthleteRow) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = AthletePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const normalizedName = normalizeAthleteName(parsed.data.name);
    const sportPodiumPhotoUrls = normalizeSportPodiumPhotoUrls(parsed.data.sportPodiumPhotoUrls);
    const hasSportPodiumPhotoUrls = Object.keys(sportPodiumPhotoUrls).length > 0;
    const insertPayload: Record<string, unknown> = {
      name: parsed.data.name,
      normalized_name: normalizedName,
      profile_photo_url: parsed.data.profilePhotoUrl ?? null,
      podium_photo_url: parsed.data.podiumPhotoUrl ?? null,
      sport_podium_photo_urls: sportPodiumPhotoUrls,
      podium_photo_adjustments: parsed.data.podiumPhotoAdjustments ?? {},
    };
    let { data, error } = await supabase
      .from("athletes")
      .insert(insertPayload)
      .select(athleteSelectColumns())
      .single();
    if (error && isMissingAthletePodiumPhotoAdjustmentsColumn(error)) {
      delete insertPayload.podium_photo_adjustments;
      ({ data, error } = await supabase
        .from("athletes")
        .insert(insertPayload)
        .select(athleteSelectColumns({ includePodiumPhotoAdjustments: false }))
        .single());
    }
    if (error && isMissingAthleteSportPodiumPhotoUrlsColumn(error)) {
      if (hasSportPodiumPhotoUrls) {
        return NextResponse.json({ error: ATHLETE_SPORT_PODIUM_PHOTO_URLS_MIGRATION_MESSAGE }, { status: 409 });
      }

      delete insertPayload.sport_podium_photo_urls;
      ({ data, error } = await supabase
        .from("athletes")
        .insert(insertPayload)
        .select(athleteSelectColumns({ includePodiumPhotoAdjustments: "podium_photo_adjustments" in insertPayload, includeSportPodiumPhotoUrls: false }))
        .single());
    }

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ athlete: mapAthleteRow(data as unknown as AthleteRow) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
