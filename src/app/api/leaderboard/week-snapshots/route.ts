import { type NextRequest } from "next/server";
import { z } from "zod";
import { GLOBAL_LEADERBOARD_CLIENT_ID, requireLeaderboardAdmin } from "@/lib/leaderboard/admin-auth";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  LeaderboardWeekSnapshotSchema,
  weekIndexFromWeekNumber,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SNAPSHOT_SELECT =
  "id,client_id,season_year,week_number,template_id,spec,total,athlete_count,exported_at,created_at,updated_at";

const OptionalSnapshotQuerySchema = z.object({
  seasonYear: z.string().trim().min(1).optional(),
  templateId: z.string().trim().min(1).optional(),
  beforeWeekNumber: z.string().trim().min(1).optional(),
});
const SaveSnapshotSchema = z.object({
  snapshot: LeaderboardWeekSnapshotSchema,
});
const DeleteSnapshotSchema = z.object({
  seasonYear: z.string().trim().min(1),
  weekNumber: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
});

interface LeaderboardWeekSnapshotRow {
  id: string;
  client_id: string;
  season_year: string;
  week_number: string;
  template_id: string;
  spec: unknown;
  total: number | string;
  athlete_count: number;
  exported_at: string;
  created_at: string;
  updated_at: string;
}

function snapshotError(message: string, error: unknown, status = 500) {
  const detail = errorMessage(error, "Unknown leaderboard snapshot error");
  console.error("LEADERBOARD_WEEK_SNAPSHOT_FAILED", { message, error: detail });
  return Response.json({ success: false, message, error: detail }, { status });
}

function mapSnapshotRow(row: LeaderboardWeekSnapshotRow): LeaderboardWeekSnapshot | undefined {
  const parsed = LeaderboardWeekSnapshotSchema.safeParse({
    id: row.id,
    clientId: row.client_id,
    seasonYear: row.season_year,
    weekNumber: row.week_number,
    templateId: row.template_id,
    spec: row.spec,
    total: Number(row.total),
    athleteCount: row.athlete_count,
    exportedAt: row.exported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  return parsed.success ? parsed.data : undefined;
}

export async function GET(request: NextRequest) {
  const parsed = OptionalSnapshotQuerySchema.safeParse({
    seasonYear: request.nextUrl.searchParams.get("seasonYear") ?? undefined,
    templateId: request.nextUrl.searchParams.get("templateId") ?? undefined,
    beforeWeekNumber: request.nextUrl.searchParams.get("beforeWeekNumber") ?? undefined,
  });
  if (!parsed.success) {
    return snapshotError("Invalid leaderboard snapshot query", parsed.error, 400);
  }

  const { seasonYear, templateId, beforeWeekNumber } = parsed.data;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("leaderboard_week_snapshots")
      .select(SNAPSHOT_SELECT)
      .eq("client_id", GLOBAL_LEADERBOARD_CLIENT_ID)
      .order("exported_at", { ascending: false })
      .limit(50);

    if (error) {
      return snapshotError("Failed to load leaderboard snapshots", error);
    }

    const snapshots = ((data ?? []) as LeaderboardWeekSnapshotRow[])
      .map(mapSnapshotRow)
      .filter((snapshot): snapshot is LeaderboardWeekSnapshot => Boolean(snapshot));
    const previousSnapshot =
      seasonYear && templateId && beforeWeekNumber
        ? snapshots.find(
            (snapshot) =>
              snapshot.seasonYear === seasonYear &&
              snapshot.templateId === templateId &&
              weekIndexFromWeekNumber(snapshot.weekNumber) === weekIndexFromWeekNumber(beforeWeekNumber) - 1,
          ) ?? null
        : null;

    return Response.json({
      success: true,
      snapshots,
      previousSnapshot,
    });
  } catch (error) {
    return snapshotError("Failed to load leaderboard snapshots", error);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireLeaderboardAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = SaveSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return snapshotError("Invalid leaderboard snapshot", parsed.error, 400);
  }

  const { snapshot } = parsed.data;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("leaderboard_week_snapshots")
      .upsert(
        {
          client_id: GLOBAL_LEADERBOARD_CLIENT_ID,
          season_year: snapshot.seasonYear,
          week_number: snapshot.weekNumber,
          week_index: weekIndexFromWeekNumber(snapshot.weekNumber),
          template_id: snapshot.templateId,
          spec: snapshot.spec,
          total: snapshot.total,
          athlete_count: snapshot.athleteCount,
          exported_at: snapshot.exportedAt,
        },
        { onConflict: "client_id,season_year,week_number,template_id" },
      )
      .select(SNAPSHOT_SELECT)
      .single();

    if (error) {
      return snapshotError("Failed to save leaderboard snapshot", error);
    }

    const savedSnapshot = mapSnapshotRow(data as LeaderboardWeekSnapshotRow);
    return Response.json({ success: true, snapshot: savedSnapshot ?? snapshot });
  } catch (error) {
    return snapshotError("Failed to save leaderboard snapshot", error);
  }
}

export async function DELETE(request: Request) {
  const unauthorized = requireLeaderboardAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = DeleteSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return snapshotError("Invalid leaderboard snapshot delete request", parsed.error, 400);
  }

  const { seasonYear, weekNumber, templateId } = parsed.data;

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("leaderboard_week_snapshots")
      .delete()
      .eq("client_id", GLOBAL_LEADERBOARD_CLIENT_ID)
      .eq("season_year", seasonYear)
      .eq("week_number", weekNumber)
      .eq("template_id", templateId);

    if (error) {
      return snapshotError("Failed to delete leaderboard snapshot", error);
    }

    return Response.json({ success: true });
  } catch (error) {
    return snapshotError("Failed to delete leaderboard snapshot", error);
  }
}
