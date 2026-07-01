import { NextResponse } from "next/server";
import { z } from "zod";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { bucketNotFoundMessage, ensureAthleteStorageBuckets, isBucketNotFoundError } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BucketSchema = z.enum(["athlete-profile", "athlete-podium"]);

function safeFilename(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return `${crypto.randomUUID()}.${extension}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const bucket = BucketSchema.safeParse(formData.get("bucket"));
    const file = formData.get("file");

    if (!bucket.success) {
      return NextResponse.json({ error: "Invalid athlete image bucket." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
    }

    const allowedTypes =
      bucket.data === "athlete-podium" ? ["image/png", "image/webp"] : ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            bucket.data === "athlete-podium"
              ? "Podium photos must be PNG or WebP files."
              : "Profile photos must be PNG, JPEG, or WebP files.",
        },
        { status: 400 },
      );
    }

    const maxSize = bucket.data === "athlete-podium" ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Image file is too large." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    await ensureAthleteStorageBuckets(supabase, [bucket.data]);

    const path = `uploads/${safeFilename(file.name)}`;
    const { error } = await supabase.storage.from(bucket.data).upload(path, await file.arrayBuffer(), {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      if (isBucketNotFoundError(error)) {
        return NextResponse.json({ error: bucketNotFoundMessage(bucket.data) }, { status: 500 });
      }

      throw error;
    }

    const { data } = supabase.storage.from(bucket.data).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, bucket: bucket.data, path });
  } catch (error) {
    const message = errorMessage(error, "Athlete image upload failed.");
    return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
  }
}
