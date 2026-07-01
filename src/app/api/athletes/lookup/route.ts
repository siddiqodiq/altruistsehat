import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import { errorMessage } from "@/lib/supabase/errors";
import {
  athleteSelectColumns,
  createSupabaseServiceClient,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  mapAthleteRow,
  type AthleteRow,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LookupPayloadSchema = z.object({
  names: z.array(z.string().min(1)).max(100),
});

function lookupQuery(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  normalizedNames: string[],
  options: { includePodiumPhotoAdjustments: boolean; includeSportPodiumPhotoUrls: boolean },
) {
  return supabase
    .from("athletes")
    .select(athleteSelectColumns(options))
    .in("normalized_name", normalizedNames);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = LookupPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const normalizedNames = Array.from(new Set(parsed.data.names.map(normalizeAthleteName).filter(Boolean)));
    if (!normalizedNames.length) {
      return NextResponse.json({ athletes: [] });
    }

    const supabase = createSupabaseServiceClient();
    const options = { includePodiumPhotoAdjustments: true, includeSportPodiumPhotoUrls: true };
    let { data, error } = await lookupQuery(supabase, normalizedNames, options);
    if (error && isMissingAthletePodiumPhotoAdjustmentsColumn(error)) {
      options.includePodiumPhotoAdjustments = false;
      ({ data, error } = await lookupQuery(supabase, normalizedNames, options));
    }
    if (error && isMissingAthleteSportPodiumPhotoUrlsColumn(error)) {
      options.includeSportPodiumPhotoUrls = false;
      ({ data, error } = await lookupQuery(supabase, normalizedNames, options));
    }

    if (error) {
      throw error;
    }

    return NextResponse.json({ athletes: ((data ?? []) as unknown as AthleteRow[]).map(mapAthleteRow) });
  } catch (error) {
    const message = errorMessage(error, "Athlete lookup failed.");
    return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
  }
}
