import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import { errorMessage } from "@/lib/supabase/errors";
import {
  createSupabaseServiceClient,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  withoutAthletePodiumPhotoAdjustments,
  withoutAthleteSportPodiumPhotoUrls,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ImportPayloadSchema = z.object({
  names: z.array(z.string()).max(1000),
});

interface ImportCandidate {
  name: string;
  normalizedName: string;
}

interface ImportSummary {
  totalRows: number;
  created: number;
  skippedDuplicates: number;
  failed: number;
}

function buildImportCandidates(names: string[]): {
  candidates: ImportCandidate[];
  fileDuplicateCount: number;
} {
  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  let fileDuplicateCount = 0;

  for (const rawName of names) {
    const name = rawName.trim();
    const normalizedName = normalizeAthleteName(name);
    if (!normalizedName) {
      continue;
    }

    if (seen.has(normalizedName)) {
      fileDuplicateCount += 1;
      continue;
    }

    seen.add(normalizedName);
    candidates.push({ name, normalizedName });
  }

  return { candidates, fileDuplicateCount };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = ImportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const totalRows = parsed.data.names.length;
    const { candidates, fileDuplicateCount } = buildImportCandidates(parsed.data.names);
    if (!candidates.length) {
      return NextResponse.json({ error: "No valid athlete names found." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const normalizedNames = candidates.map((candidate) => candidate.normalizedName);
    const { data: existingRows, error: existingError } = await supabase
      .from("athletes")
      .select("normalized_name")
      .in("normalized_name", normalizedNames);

    if (existingError) {
      throw existingError;
    }

    const existingNames = new Set((existingRows ?? []).map((row) => String(row.normalized_name)));
    const newCandidates = candidates.filter((candidate) => !existingNames.has(candidate.normalizedName));
    const skippedDuplicates = fileDuplicateCount + (candidates.length - newCandidates.length);
    const insertRows = newCandidates.map((candidate) => ({
      name: candidate.name,
      normalized_name: candidate.normalizedName,
      podium_photo_adjustments: {},
      sport_podium_photo_urls: {},
      profile_photo_url: null,
      podium_photo_url: null,
    }));

    if (!insertRows.length) {
      const summary: ImportSummary = {
        totalRows,
        created: 0,
        skippedDuplicates,
        failed: 0,
      };
      return NextResponse.json({ summary }, { status: 200 });
    }

    let { error: insertError } = await supabase.from("athletes").insert(insertRows);
    if (insertError && isMissingAthletePodiumPhotoAdjustmentsColumn(insertError)) {
      ({ error: insertError } = await supabase.from("athletes").insert(insertRows.map(withoutAthletePodiumPhotoAdjustments)));
    }
    if (insertError && isMissingAthleteSportPodiumPhotoUrlsColumn(insertError)) {
      ({ error: insertError } = await supabase.from("athletes").insert(insertRows.map(withoutAthleteSportPodiumPhotoUrls)));
    }

    if (insertError) {
      const summary: ImportSummary = {
        totalRows,
        created: 0,
        skippedDuplicates,
        failed: insertRows.length,
      };
      return NextResponse.json({ error: insertError.message, summary }, { status: 500 });
    }

    const summary: ImportSummary = {
      totalRows,
      created: insertRows.length,
      skippedDuplicates,
      failed: 0,
    };

    return NextResponse.json({ summary }, { status: 201 });
  } catch (error) {
    const message = errorMessage(error, "Athlete import failed.");
    return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
  }
}
