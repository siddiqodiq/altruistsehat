import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/supabase/auth-server";
import { errorMessage } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isBucketNotFoundError } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVITY_IMAGES_BUCKET = "activity-images";
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

function safeFilename(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  return `${crypto.randomUUID()}.${extension}`;
}

async function ensureActivityImagesBucket(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw error;
  }

  if ((buckets ?? []).some((bucket) => bucket.id === ACTIVITY_IMAGES_BUCKET)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(ACTIVITY_IMAGES_BUCKET, {
    allowedMimeTypes: ALLOWED_TYPES,
    fileSizeLimit: MAX_SIZE,
    public: true,
  });
  if (createError) {
    throw createError;
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Activity images must be PNG, JPEG, or WebP files." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Image file is too large." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    await ensureActivityImagesBucket(supabase);

    const path = `uploads/${safeFilename(file.name)}`;
    const { error } = await supabase.storage.from(ACTIVITY_IMAGES_BUCKET).upload(path, await file.arrayBuffer(), {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      if (isBucketNotFoundError(error)) {
        return NextResponse.json({ error: `Bucket "${ACTIVITY_IMAGES_BUCKET}" does not exist.` }, { status: 500 });
      }
      throw error;
    }

    const { data } = supabase.storage.from(ACTIVITY_IMAGES_BUCKET).getPublicUrl(path);
    return NextResponse.json({ path, url: data.publicUrl });
  } catch (error) {
    const message = errorMessage(error, "Activity image upload failed.");
    return NextResponse.json({ error: message }, { status: message.includes("Supabase is not configured") ? 503 : 500 });
  }
}
