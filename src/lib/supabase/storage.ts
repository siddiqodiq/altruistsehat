import type { SupabaseClient } from "@supabase/supabase-js";

export const ATHLETE_STORAGE_BUCKETS = [
  {
    id: "athlete-profile",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  {
    id: "athlete-podium",
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/webp"],
  },
] as const;

export type AthleteStorageBucketId = (typeof ATHLETE_STORAGE_BUCKETS)[number]["id"];

export interface AthleteStorageValidationResult {
  found: AthleteStorageBucketId[];
  created: AthleteStorageBucketId[];
  missing: AthleteStorageBucketId[];
}

export function isAthleteStorageBucketId(value: string): value is AthleteStorageBucketId {
  return ATHLETE_STORAGE_BUCKETS.some((bucket) => bucket.id === value);
}

export function isBucketNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const values = Object.values(error as Record<string, unknown>).map(String).join(" ").toLowerCase();
  return values.includes("bucket not found") || values.includes("bucket_id") || values.includes("not found");
}

export function bucketNotFoundMessage(bucket: AthleteStorageBucketId) {
  return `Bucket "${bucket}" does not exist. Run npm run init-storage or open the Athlete Database page to initialize storage.`;
}

export async function ensureAthleteStorageBuckets(
  supabase: SupabaseClient,
  bucketIds: AthleteStorageBucketId[] = ATHLETE_STORAGE_BUCKETS.map((bucket) => bucket.id),
): Promise<AthleteStorageValidationResult> {
  const requiredBuckets = ATHLETE_STORAGE_BUCKETS.filter((bucket) => bucketIds.includes(bucket.id));
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const existingIds = new Set((existingBuckets ?? []).map((bucket) => bucket.id));
  const found: AthleteStorageBucketId[] = [];
  const created: AthleteStorageBucketId[] = [];

  for (const bucket of requiredBuckets) {
    if (existingIds.has(bucket.id)) {
      found.push(bucket.id);
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: [...bucket.allowedMimeTypes],
    });

    if (error) {
      throw error;
    }

    created.push(bucket.id);
    existingIds.add(bucket.id);
  }

  return {
    found,
    created,
    missing: requiredBuckets
      .map((bucket) => bucket.id)
      .filter((bucketId) => !found.includes(bucketId) && !created.includes(bucketId)),
  };
}
