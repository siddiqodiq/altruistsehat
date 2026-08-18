#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STRAVA_ATHLETE_CDN_HOSTS = new Set(["dgalywyr863hv.cloudfront.net"]);
const PROFILE_BUCKET = "athlete-profile";
const PODIUM_BUCKET = "athlete-podium";
const MAX_PROFILE_BYTES = 5 * 1024 * 1024;
const MAX_PODIUM_BYTES = 8 * 1024 * 1024;
const DIRECT_TIMEOUT_MS = 2500;
const PROXY_TIMEOUT_MS = 20000;
const OUTPUT_DIR = path.join(process.cwd(), "output", "migrations");

const argv = process.argv.slice(2);
const args = new Set(argv.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
const apply = args.has("--apply");
const allowProxy = args.has("--allow-proxy");

function optionValue(name) {
  const match = argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

const limit = Number.parseInt(optionValue("--limit") ?? "", 10);
const onlyId = optionValue("--id");

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) {
    return;
  }

  for (const line of fs.readFileSync(filename, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeSupabaseUrl(value) {
  const dashboardMatch = value.match(/^https:\/\/supabase\.com\/dashboard\/project\/([a-z0-9]+)\/?$/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  return value;
}

function isStravaAthletePhotoUrl(value) {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return STRAVA_ATHLETE_CDN_HOSTS.has(url.hostname.toLowerCase()) && url.pathname.startsWith("/pictures/athletes/");
  } catch {
    return false;
  }
}

function isSupabaseStoragePhotoUrl(value, supabaseUrl) {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    const project = new URL(supabaseUrl);
    return (
      parsed.origin === project.origin &&
      (parsed.pathname.includes(`/storage/v1/object/public/${PROFILE_BUCKET}/`) ||
        parsed.pathname.includes(`/storage/v1/object/public/${PODIUM_BUCKET}/`))
    );
  } catch {
    return false;
  }
}

function extensionForPhoto(contentType, sourceUrl) {
  const type = contentType.split(";")[0]?.trim().toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") {
    return "jpg";
  }
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }

  try {
    const extension = new URL(sourceUrl).pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (["jpg", "jpeg", "png", "webp"].includes(extension ?? "")) {
      return extension === "jpeg" ? "jpg" : extension;
    }
  } catch {
    // Fall back below.
  }

  return "jpg";
}

function slugForPath(value) {
  return (
    String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "athlete"
  );
}

function proxyUrlFor(sourceUrl) {
  const withoutProtocol = sourceUrl.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(withoutProtocol)}`;
}

async function downloadWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://www.strava.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`Unexpected content type: ${contentType || "(none)"}`);
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length) {
      throw new Error("Downloaded empty image");
    }

    return { body, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadPhoto(sourceUrl, state) {
  const sourceHost = new URL(sourceUrl).hostname.toLowerCase();

  if (!state.directFailedHosts.has(sourceHost)) {
    try {
      return {
        ...(await downloadWithTimeout(sourceUrl, DIRECT_TIMEOUT_MS)),
        source: "direct",
      };
    } catch (error) {
      state.directFailedHosts.add(sourceHost);
      if (!allowProxy) {
        throw error;
      }
    }
  }

  if (!allowProxy) {
    throw new Error("Proxy fallback disabled");
  }

  return {
    ...(await downloadWithTimeout(proxyUrlFor(sourceUrl), PROXY_TIMEOUT_MS)),
    source: "images.weserv.nl",
  };
}

function collectJobs(athlete, supabaseUrl) {
  const jobs = [];

  if (isStravaAthletePhotoUrl(athlete.profile_photo_url) && !isSupabaseStoragePhotoUrl(athlete.profile_photo_url, supabaseUrl)) {
    jobs.push({
      bucket: PROFILE_BUCKET,
      field: "profile_photo_url",
      kind: "profile",
      maxBytes: MAX_PROFILE_BYTES,
      sourceUrl: athlete.profile_photo_url,
    });
  }

  if (isStravaAthletePhotoUrl(athlete.podium_photo_url) && !isSupabaseStoragePhotoUrl(athlete.podium_photo_url, supabaseUrl)) {
    jobs.push({
      bucket: PODIUM_BUCKET,
      field: "podium_photo_url",
      kind: "podium",
      maxBytes: MAX_PODIUM_BYTES,
      sourceUrl: athlete.podium_photo_url,
    });
  }

  const sportPhotos =
    athlete.sport_podium_photo_urls && typeof athlete.sport_podium_photo_urls === "object" && !Array.isArray(athlete.sport_podium_photo_urls)
      ? athlete.sport_podium_photo_urls
      : {};

  for (const [sport, value] of Object.entries(sportPhotos)) {
    if (isStravaAthletePhotoUrl(value) && !isSupabaseStoragePhotoUrl(value, supabaseUrl)) {
      jobs.push({
        bucket: PODIUM_BUCKET,
        field: "sport_podium_photo_urls",
        kind: `sport-${slugForPath(sport)}`,
        maxBytes: MAX_PODIUM_BYTES,
        sourceUrl: value,
        sport,
      });
    }
  }

  return jobs;
}

function storagePathFor({ athlete, job, body, contentType }) {
  const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
  const extension = extensionForPhoto(contentType, job.sourceUrl);
  return `migrated/${job.kind}/${slugForPath(athlete.name)}-${athlete.id}-${hash}.${extension}`;
}

async function uploadPhoto({ supabase, athlete, job, body, contentType }) {
  const bucket = job.bucket;
  const storagePath = storagePathFor({ athlete, job, body, contentType });
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, body, {
    cacheControl: "31536000",
    contentType,
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data.publicUrl) {
    throw new Error(`Could not create public URL for ${bucket}/${storagePath}`);
  }

  return { publicUrl: data.publicUrl, storagePath };
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJsonReport(prefix, payload) {
  ensureOutputDir();
  const filename = path.join(OUTPUT_DIR, `${prefix}-${timestamp()}.json`);
  fs.writeFileSync(filename, `${JSON.stringify(payload, null, 2)}\n`);
  return filename;
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || "");
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required.");
  }

  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || requireEnv("SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let query = supabase
    .from("athletes")
    .select("id,name,profile_photo_url,podium_photo_url,sport_podium_photo_urls")
    .order("name", { ascending: true });

  if (onlyId) {
    query = query.eq("id", onlyId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const athletes = Number.isFinite(limit) && limit > 0 ? (data ?? []).slice(0, limit) : data ?? [];
  const planned = athletes.flatMap((athlete) => collectJobs(athlete, supabaseUrl).map((job) => ({ athlete, job })));

  console.log(`${apply ? "Apply" : "Dry run"}: ${planned.length} Strava athlete photo URL(s) pending migration.`);
  for (const { athlete, job } of planned) {
    console.log(`- ${athlete.name}: ${job.field}${job.sport ? `.${job.sport}` : ""} -> ${job.bucket}`);
  }

  if (!planned.length) {
    return;
  }

  if (!apply) {
    console.log("No database changes written. Re-run with --apply to upload files and update athlete photo URLs.");
    if (!allowProxy) {
      console.log("Add --allow-proxy if direct Strava CDN downloads still fail and you accept using images.weserv.nl as a temporary fetch proxy.");
    }
    return;
  }

  const backupPath = writeJsonReport(
    "backup-athlete-photo-urls",
    athletes.map((athlete) => ({
      id: athlete.id,
      name: athlete.name,
      podium_photo_url: athlete.podium_photo_url,
      profile_photo_url: athlete.profile_photo_url,
      sport_podium_photo_urls: athlete.sport_podium_photo_urls,
    })),
  );
  console.log(`Backup written: ${backupPath}`);

  const results = [];
  const state = { directFailedHosts: new Set() };

  for (const athlete of athletes) {
    const jobs = collectJobs(athlete, supabaseUrl);
    if (!jobs.length) {
      continue;
    }

    const patch = {};
    let sportPatch =
      athlete.sport_podium_photo_urls && typeof athlete.sport_podium_photo_urls === "object" && !Array.isArray(athlete.sport_podium_photo_urls)
        ? { ...athlete.sport_podium_photo_urls }
        : undefined;
    const athleteResults = [];

    for (const job of jobs) {
      try {
        const downloaded = await downloadPhoto(job.sourceUrl, state);
        if (downloaded.body.byteLength > job.maxBytes) {
          throw new Error(`Downloaded image is too large: ${downloaded.body.byteLength} bytes`);
        }

        const uploaded = await uploadPhoto({
          athlete,
          body: downloaded.body,
          contentType: downloaded.contentType,
          job,
          supabase,
        });

        if (job.field === "sport_podium_photo_urls") {
          sportPatch ??= {};
          sportPatch[job.sport] = uploaded.publicUrl;
        } else {
          patch[job.field] = uploaded.publicUrl;
        }

        athleteResults.push({
          bucket: job.bucket,
          bytes: downloaded.body.byteLength,
          field: job.field,
          oldUrl: job.sourceUrl,
          source: downloaded.source,
          sport: job.sport,
          storagePath: uploaded.storagePath,
          url: uploaded.publicUrl,
        });
        console.log(`Migrated ${athlete.name}: ${job.field}${job.sport ? `.${job.sport}` : ""} via ${downloaded.source}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        athleteResults.push({
          error: message,
          field: job.field,
          oldUrl: job.sourceUrl,
          sport: job.sport,
        });
        console.error(`Failed ${athlete.name}: ${job.field}${job.sport ? `.${job.sport}` : ""} - ${message}`);
      }
    }

    if (sportPatch) {
      patch.sport_podium_photo_urls = sportPatch;
    }

    if (Object.keys(patch).length) {
      const { error: updateError } = await supabase.from("athletes").update(patch).eq("id", athlete.id);
      if (updateError) {
        throw updateError;
      }
    }

    results.push({
      id: athlete.id,
      name: athlete.name,
      updates: athleteResults,
    });
  }

  const reportPath = writeJsonReport("migrate-athlete-photos", {
    allowProxy,
    backupPath,
    results,
  });
  const migrated = results.flatMap((row) => row.updates).filter((update) => update.url).length;
  const failed = results.flatMap((row) => row.updates).filter((update) => update.error).length;
  console.log(`Report written: ${reportPath}`);
  console.log(`Migration result: ${migrated} uploaded/update candidate(s), ${failed} failed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
