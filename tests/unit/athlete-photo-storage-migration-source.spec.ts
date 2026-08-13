import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function migrationScriptSource() {
  return fs.readFileSync(path.join(process.cwd(), "scripts/migrate-athlete-photos-to-supabase-storage.mjs"), "utf8");
}

test("athlete photo storage migration is dry-run by default and requires explicit apply", () => {
  const source = migrationScriptSource();

  expect(source).toContain("const apply = args.has(\"--apply\")");
  expect(source).toContain("No database changes written. Re-run with --apply");
  expect(source).toContain("backup-athlete-photo-urls");
});

test("athlete photo storage migration uploads copied files before updating athlete rows", () => {
  const source = migrationScriptSource();
  const uploadIndex = source.indexOf(".storage.from(bucket).upload");
  const publicUrlIndex = source.indexOf(".storage.from(bucket).getPublicUrl");
  const updateIndex = source.indexOf(".from(\"athletes\").update");

  expect(source).toContain("athlete-profile");
  expect(source).toContain("profile_photo_url");
  expect(source).toContain("isStravaAthletePhotoUrl");
  expect(source).toContain("isSupabaseStoragePhotoUrl");
  expect(uploadIndex).toBeGreaterThan(-1);
  expect(publicUrlIndex).toBeGreaterThan(uploadIndex);
  expect(updateIndex).toBeGreaterThan(publicUrlIndex);
});

test("athlete photo storage migration keeps proxy fallback explicit", () => {
  const source = migrationScriptSource();

  expect(source).toContain("const allowProxy = args.has(\"--allow-proxy\")");
  expect(source).toContain("images.weserv.nl");
  expect(source).toContain("Proxy fallback disabled");
});
