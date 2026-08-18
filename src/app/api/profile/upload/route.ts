import { NextResponse } from "next/server";
import { normalizeProfilePhotoKind } from "@/lib/profile/summary";
import { getCurrentAuthProfile, type CurrentAuthProfile } from "@/lib/supabase/auth-server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { bucketNotFoundMessage, ensureAthleteStorageBuckets, isBucketNotFoundError } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthenticatedProfile = CurrentAuthProfile & {
  athlete: NonNullable<CurrentAuthProfile["athlete"]>;
};

function safeFilename(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  return `${crypto.randomUUID()}.${extension}`;
}

function profileUploadError(error: unknown) {
  const message = errorMessage(error, "Profile image upload failed.");
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

export async function POST(request: Request) {
  try {
    const auth = await requireLinkedProfile();
    if ("response" in auth) {
      return auth.response;
    }

    const profile = auth.profile;
    const formData = await request.formData();
    const file = formData.get("file");
    const kind = normalizeProfilePhotoKind(formData.get("kind"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload file gambar." }, { status: 400 });
    }

    const allowedTypes =
      kind.bucket === "athlete-profile" ? ["image/png", "image/jpeg", "image/webp"] : ["image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Format gambar tidak valid." }, { status: 400 });
    }

    const maxSize = kind.bucket === "athlete-profile" ? 5 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Ukuran gambar terlalu besar." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("id")
      .eq("auth_user_id", profile.userId)
      .maybeSingle();

    if (athleteError) {
      throw athleteError;
    }

    if (!athlete) {
      return NextResponse.json({ error: "Akun belum terhubung ke atlet." }, { status: 403 });
    }

    await ensureAthleteStorageBuckets(supabase, [kind.bucket]);

    const path = `profile/${profile.athlete.id}/${safeFilename(file.name)}`;
    const { error } = await supabase.storage.from(kind.bucket).upload(path, await file.arrayBuffer(), {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      if (isBucketNotFoundError(error)) {
        return NextResponse.json({ error: bucketNotFoundMessage(kind.bucket) }, { status: 500 });
      }

      throw error;
    }

    const { data } = supabase.storage.from(kind.bucket).getPublicUrl(path);
    return NextResponse.json({ kind, path, url: data.publicUrl });
  } catch (error) {
    return profileUploadError(error);
  }
}
