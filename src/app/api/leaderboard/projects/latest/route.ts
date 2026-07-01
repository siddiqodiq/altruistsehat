import { type NextRequest } from "next/server";
import { z } from "zod";
import { GLOBAL_LEADERBOARD_CLIENT_ID, requireLeaderboardAdmin } from "@/lib/leaderboard/admin-auth";
import {
  categoryForTemplateId,
  normalizeLeaderboardCategory,
  projectIdForCategory,
  templateIdForCategory,
} from "@/lib/leaderboard/categories";
import { LeaderboardProjectStateSchema } from "@/lib/leaderboard/project-state";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveProjectSchema = z.object({
  category: z.string().trim().min(1).optional(),
  clientId: z.string().trim().min(1).optional(),
  project: LeaderboardProjectStateSchema,
});

function projectError(message: string, error: unknown, status = 500) {
  const detail = errorMessage(error, "Unknown leaderboard project error");
  console.error("LEADERBOARD_PROJECT_SAVE_FAILED", { message, error: detail });
  return Response.json({ success: false, message, error: detail }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const categoryParam = request.nextUrl.searchParams.get("category");
    const categoryId = categoryParam ? normalizeLeaderboardCategory(categoryParam) : undefined;
    const supabase = createSupabaseServiceClient();
    const baseQuery = supabase
      .from("leaderboard_projects")
      .select("state")
      .eq("client_id", GLOBAL_LEADERBOARD_CLIENT_ID);
    const query = categoryId
      ? baseQuery.eq("project_id", projectIdForCategory(categoryId))
      : baseQuery.order("updated_at", { ascending: false }).limit(1);
    const { data, error } = await query.maybeSingle();

    if (error) {
      return projectError("Failed to load leaderboard project", error);
    }

    const parsed = data?.state ? LeaderboardProjectStateSchema.safeParse(data.state) : undefined;
    return Response.json({
      success: true,
      project: parsed?.success ? parsed.data : null,
    });
  } catch (error) {
    return projectError("Failed to load leaderboard project", error);
  }
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireLeaderboardAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = SaveProjectSchema.safeParse(body);
  if (!parsed.success) {
    return projectError("Invalid leaderboard project", parsed.error, 400);
  }

  const { project } = parsed.data;
  const categoryId = parsed.data.category
    ? normalizeLeaderboardCategory(parsed.data.category)
    : categoryForTemplateId(project.templateId);
  const categoryProject = {
    ...project,
    projectId: projectIdForCategory(categoryId),
    templateId: templateIdForCategory(categoryId),
  };

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("leaderboard_projects").upsert(
      {
        project_id: categoryProject.projectId,
        client_id: GLOBAL_LEADERBOARD_CLIENT_ID,
        status: categoryProject.status,
        state: categoryProject,
        updated_at: categoryProject.updatedAt,
      },
      { onConflict: "project_id" },
    );

    if (error) {
      return projectError("Failed to save leaderboard project", error);
    }

    return Response.json({ success: true, project: categoryProject });
  } catch (error) {
    return projectError("Failed to save leaderboard project", error);
  }
}
