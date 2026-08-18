import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAthleteName } from "@/lib/athletes/normalize";
import { normalizeSportPodiumPhotoUrls } from "@/lib/athletes/sport-podium-photos";
import { SportPodiumPhotoUrlsSchema } from "@/lib/athletes/sport-podium-photos-schema";
import { buildAthleteProfileSummary } from "@/lib/profile/summary";
import { getCurrentAuthProfile, type CurrentAuthProfile } from "@/lib/supabase/auth-server";
import { errorMessage } from "@/lib/supabase/errors";
import {
  athleteSelectColumns,
  createSupabaseServiceClient,
  mapAthleteRow,
  type AthleteRow,
} from "@/lib/supabase/server";
import { LeaderboardWeekSnapshotSchema } from "@/lib/leaderboard/week-snapshots";
import type { AthleteRecord } from "@/lib/athletes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OptionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z.string().url().nullable().optional(),
);

const ProfilePatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  podiumPhotoUrl: OptionalUrlSchema,
  profilePhotoUrl: OptionalUrlSchema,
  sportPodiumPhotoUrls: SportPodiumPhotoUrlsSchema.optional(),
});

type AuthenticatedProfile = CurrentAuthProfile & {
  athlete: NonNullable<CurrentAuthProfile["athlete"]>;
};

interface ActivityParticipantSportRow {
  activities?: { sport_type?: string | null } | { sport_type?: string | null }[] | null;
}

interface LeaderboardWeekSnapshotRow {
  athlete_count: number;
  client_id: string;
  created_at?: string | null;
  exported_at: string;
  id?: string | null;
  season_year: string;
  spec: unknown;
  template_id: string;
  total: number | string;
  updated_at?: string | null;
  week_number: string;
}

function profileErrorResponse(error: unknown, fallback = "Profile request failed.") {
  const message = errorMessage(error, fallback);
  return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
}

async function requireLinkedProfile(): Promise<{ profile: AuthenticatedProfile } | { response: NextResponse }> {
  const profile = await getCurrentAuthProfile();
  if (!profile) {
    return { response: NextResponse.json({ error: "Login required." }, { status: 401 }) };
  }

  if (!profile.athlete) {
    return { response: NextResponse.json({ error: "Akun belum terhubung ke atlet." }, { status: 403 }) };
  }

  return { profile: { ...profile, athlete: profile.athlete } };
}

async function requireAuthProfile(): Promise<{ profile: CurrentAuthProfile } | { response: NextResponse }> {
  const profile = await getCurrentAuthProfile();
  if (!profile) {
    return { response: NextResponse.json({ error: "Login required." }, { status: 401 }) };
  }

  return { profile };
}

async function loadProfileAthlete(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  profile: AuthenticatedProfile,
): Promise<AthleteRecord | null> {
  const { data, error } = await supabase
    .from("athletes")
    .select(athleteSelectColumns())
    .eq("auth_user_id", profile.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapAthleteRow(data as unknown as AthleteRow) : null;
}

async function loadActivitySports(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  athleteId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("activity_participants")
    .select("activities(sport_type)")
    .eq("athlete_id", athleteId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ActivityParticipantSportRow[]).flatMap((row) => {
    const activities = Array.isArray(row.activities) ? row.activities : row.activities ? [row.activities] : [];
    return activities.map((activity) => activity.sport_type ?? "").filter(Boolean);
  });
}

function mapSnapshotRow(row: LeaderboardWeekSnapshotRow) {
  const parsed = LeaderboardWeekSnapshotSchema.safeParse({
    athleteCount: row.athlete_count,
    clientId: row.client_id,
    createdAt: row.created_at ?? undefined,
    exportedAt: row.exported_at,
    id: row.id ?? undefined,
    seasonYear: row.season_year,
    spec: row.spec,
    templateId: row.template_id,
    total: Number(row.total),
    updatedAt: row.updated_at ?? undefined,
    weekNumber: row.week_number,
  });

  return parsed.success ? parsed.data : undefined;
}

async function loadLeaderboardSnapshots(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("leaderboard_week_snapshots")
    .select("id,client_id,season_year,week_number,template_id,spec,total,athlete_count,exported_at,created_at,updated_at")
    .order("exported_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as LeaderboardWeekSnapshotRow[]).map(mapSnapshotRow).filter((snapshot): snapshot is NonNullable<ReturnType<typeof mapSnapshotRow>> => Boolean(snapshot));
}

async function profilePayload(profile: AuthenticatedProfile) {
  const supabase = createSupabaseServiceClient();
  const athlete = await loadProfileAthlete(supabase, profile);
  if (!athlete) {
    return {
      athlete: null,
      mileageBySport: [],
      role: profile.role,
      sports: [],
    };
  }

  const [activitySports, snapshots] = await Promise.all([
    loadActivitySports(supabase, athlete.id),
    loadLeaderboardSnapshots(supabase),
  ]);
  const summary = buildAthleteProfileSummary({ activitySports, athlete, snapshots });

  return {
    athlete,
    mileageBySport: summary.mileageBySport,
    role: profile.role,
    sports: summary.sports,
  };
}

export async function GET() {
  try {
    const auth = await requireAuthProfile();
    if ("response" in auth) {
      return auth.response;
    }

    if (!auth.profile.athlete) {
      return NextResponse.json({
        athlete: null,
        mileageBySport: [],
        role: auth.profile.role,
        sports: [],
      });
    }

    return NextResponse.json(await profilePayload({ ...auth.profile, athlete: auth.profile.athlete }));
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireLinkedProfile();
    if ("response" in auth) {
      return auth.response;
    }

    const body = await request.json().catch(() => null);
    const parsed = ProfilePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data profil tidak valid." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
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
      patch.sport_podium_photo_urls = normalizeSportPodiumPhotoUrls(parsed.data.sportPodiumPhotoUrls);
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json(await profilePayload(auth.profile));
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("athletes")
      .update(patch)
      .eq("auth_user_id", auth.profile.userId)
      .select(athleteSelectColumns())
      .maybeSingle();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: status === 409 ? "Nama atlet sudah digunakan." : "Profil gagal diperbarui." }, { status });
    }

    if (!data) {
      return NextResponse.json({ error: "Akun belum terhubung ke atlet." }, { status: 403 });
    }

    return NextResponse.json(await profilePayload(auth.profile));
  } catch (error) {
    return profileErrorResponse(error);
  }
}
